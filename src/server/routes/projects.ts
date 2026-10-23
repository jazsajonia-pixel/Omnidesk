import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { requireDb } from "../db/client.js";
import { customers, projects, tasks, user } from "../db/schema.js";
import { recordActivity } from "../lib/activity.js";
import { isoDate, likePattern, notFound, parseBody, searchParam } from "../lib/http.js";
import { isTenantContext, resolveTenant } from "../tenant.js";
import type { TenantContext } from "../tenant-context.js";

export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed"] as const;
const statusLabel: Record<string, string> = { planning: "Planning", active: "Active", on_hold: "On hold", completed: "Completed" };

const projectInput = z.object({
  name: z.string().trim().min(1, "Project name is required.").max(160),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  customerId: z.string().trim().max(64).nullable().optional(),
  dueDate: z.string().regex(isoDate, "Use a valid date.").nullable().optional().or(z.literal("")),
}).strict();
const projectUpdateInput = projectInput.partial().strict();

const columns = {
  id: projects.id, name: projects.name, description: projects.description, status: projects.status,
  dueDate: projects.dueDate, customerId: projects.customerId, customerName: customers.name,
  createdAt: projects.createdAt, updatedAt: projects.updatedAt, archivedAt: projects.archivedAt,
};

async function customerBelongs(tenant: TenantContext, customerId: string | null | undefined) {
  if (!customerId) return true;
  const [row] = await requireDb().select({ id: customers.id }).from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.organizationId, tenant.organizationId))).limit(1);
  return Boolean(row);
}

export async function taskProgress(organizationId: string, projectIds: string[]) {
  if (!projectIds.length) return new Map<string, { total: number; done: number }>();
  const rows = await requireDb().select({
    projectId: tasks.projectId, total: count(),
    done: sql<number>`count(*) filter (where ${tasks.status} = 'done')`,
  }).from(tasks).where(and(eq(tasks.organizationId, organizationId), inArray(tasks.projectId, projectIds))).groupBy(tasks.projectId);
  return new Map(rows.map((row) => [row.projectId as string, { total: Number(row.total), done: Number(row.done) }]));
}

export const projectRoutes = new Hono();

projectRoutes.get("/", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const search = searchParam(c);
  const status = c.req.query("status");
  const archived = c.req.query("archived") === "true";
  const conditions = [eq(projects.organizationId, tenant.organizationId), archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt)];
  if (status && (PROJECT_STATUSES as readonly string[]).includes(status)) conditions.push(eq(projects.status, status));
  if (search) conditions.push(ilike(projects.name, likePattern(search)));
  const customerId = c.req.query("customerId");
  if (customerId) conditions.push(eq(projects.customerId, customerId));
  const rows = await requireDb().select(columns).from(projects)
    .leftJoin(customers, and(eq(customers.id, projects.customerId), eq(customers.organizationId, tenant.organizationId)))
    .where(and(...conditions)).orderBy(desc(projects.updatedAt)).limit(200);
  const progress = await taskProgress(tenant.organizationId, rows.map((row) => row.id));
  return c.json({ data: rows.map((row) => ({ ...row, progress: progress.get(row.id) ?? { total: 0, done: 0 } })) });
});

projectRoutes.get("/options", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const rows = await requireDb().select({ id: projects.id, name: projects.name, status: projects.status }).from(projects)
    .where(and(eq(projects.organizationId, tenant.organizationId), isNull(projects.archivedAt))).orderBy(projects.name).limit(500);
  return c.json({ data: rows });
});

projectRoutes.get("/:id", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const [row] = await database.select(columns).from(projects)
    .leftJoin(customers, and(eq(customers.id, projects.customerId), eq(customers.organizationId, tenant.organizationId)))
    .where(and(eq(projects.id, c.req.param("id")), eq(projects.organizationId, tenant.organizationId))).limit(1);
  if (!row) return notFound(c, "Project");
  const projectTasks = await database.select({
    id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority, dueDate: tasks.dueDate,
    assigneeId: tasks.assigneeId, assigneeName: user.name, position: tasks.position, completedAt: tasks.completedAt,
  }).from(tasks).leftJoin(user, eq(user.id, tasks.assigneeId))
    .where(and(eq(tasks.organizationId, tenant.organizationId), eq(tasks.projectId, row.id)))
    .orderBy(tasks.status, tasks.position).limit(500);
  const done = projectTasks.filter((task) => task.status === "done").length;
  return c.json({ data: { ...row, tasks: projectTasks, progress: { total: projectTasks.length, done } } });
});

projectRoutes.post("/", async (c) => {
  const tenant = await resolveTenant(c, "project:write");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, projectInput);
  if (!parsed.ok) return parsed.response;
  if (!await customerBelongs(tenant, parsed.data.customerId)) return c.json({ error: "validation_error", message: "Choose a customer from this workspace." }, 400);
  const [created] = await requireDb().insert(projects).values({
    id: randomUUID(), organizationId: tenant.organizationId, name: parsed.data.name,
    description: parsed.data.description || null, status: parsed.data.status ?? "planning",
    customerId: parsed.data.customerId || null, dueDate: parsed.data.dueDate || null, createdBy: tenant.userId,
  }).returning({ id: projects.id, name: projects.name });
  await recordActivity(tenant, { action: "project.created", entityType: "project", entityId: created.id, summary: "created project " + created.name });
  return c.json({ data: created }, 201);
});

projectRoutes.patch("/:id", async (c) => {
  const tenant = await resolveTenant(c, "project:write");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, projectUpdateInput);
  if (!parsed.ok) return parsed.response;
  if (Object.keys(parsed.data).length === 0) return c.json({ error: "validation_error", message: "Change at least one field." }, 400);
  if (!await customerBelongs(tenant, parsed.data.customerId)) return c.json({ error: "validation_error", message: "Choose a customer from this workspace." }, 400);
  const values: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) values.name = parsed.data.name;
  if (parsed.data.description !== undefined) values.description = parsed.data.description || null;
  if (parsed.data.status !== undefined) values.status = parsed.data.status;
  if (parsed.data.customerId !== undefined) values.customerId = parsed.data.customerId || null;
  if (parsed.data.dueDate !== undefined) values.dueDate = parsed.data.dueDate || null;
  const [updated] = await requireDb().update(projects).set(values)
    .where(and(eq(projects.id, c.req.param("id")), eq(projects.organizationId, tenant.organizationId), isNull(projects.archivedAt)))
    .returning({ id: projects.id, name: projects.name, status: projects.status });
  if (!updated) return notFound(c, "Project");
  const summary = parsed.data.status !== undefined && Object.keys(parsed.data).length === 1
    ? "moved project " + updated.name + " to " + (statusLabel[updated.status] ?? updated.status)
    : "updated project " + updated.name;
  await recordActivity(tenant, { action: "project.updated", entityType: "project", entityId: updated.id, summary });
  return c.json({ data: updated });
});

async function setArchived(c: Context, archived: boolean) {
  const tenant = await resolveTenant(c, "project:write");
  if (!isTenantContext(tenant)) return tenant;
  const [updated] = await requireDb().update(projects).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() }).where(and(
    eq(projects.id, c.req.param("id") ?? ""), eq(projects.organizationId, tenant.organizationId),
    archived ? isNull(projects.archivedAt) : isNotNull(projects.archivedAt),
  )).returning({ id: projects.id, name: projects.name });
  if (!updated) return notFound(c, "Project");
  await recordActivity(tenant, { action: archived ? "project.archived" : "project.restored", entityType: "project", entityId: updated.id, summary: (archived ? "archived project " : "restored project ") + updated.name });
  return c.json({ data: updated });
}
projectRoutes.post("/:id/archive", (c) => setArchived(c, true));
projectRoutes.post("/:id/restore", (c) => setArchived(c, false));
