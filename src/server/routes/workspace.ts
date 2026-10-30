import { and, count, desc, eq, isNull, lt, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireDb } from "../db/client.js";
import { activity, customers, documents, member, organization, projects, tasks, user } from "../db/schema.js";
import { recordActivity } from "../lib/activity.js";
import { notFound, parseBody, today } from "../lib/http.js";
import { normalizeRole, permissionsFor } from "../permissions.js";
import { seedWorkspace } from "../seed.js";
import { isTenantContext, resolveTenant } from "../tenant.js";

const renameInput = z.object({ name: z.string().trim().min(2, "Use at least 2 characters.").max(100) }).strict();

export const workspaceRoutes = new Hono();

workspaceRoutes.get("/", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const [org] = await database.select({ id: organization.id, name: organization.name, slug: organization.slug, createdAt: organization.createdAt, metadata: organization.metadata })
    .from(organization).where(eq(organization.id, tenant.organizationId)).limit(1);
  if (!org) return notFound(c, "Workspace");
  const [members] = await database.select({ total: count() }).from(member).where(eq(member.organizationId, tenant.organizationId));
  const isDemo = (org.metadata ?? "").includes("\"demo\":true");
  return c.json({ data: {
    id: org.id, name: org.name, slug: org.slug, createdAt: org.createdAt, isDemo,
    memberCount: Number(members?.total ?? 0), role: normalizeRole(tenant.role), permissions: permissionsFor(tenant.role),
  } });
});

workspaceRoutes.patch("/", async (c) => {
  const tenant = await resolveTenant(c, "workspace:manage");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, renameInput);
  if (parsed.ok === false) return parsed.response;
  const [updated] = await requireDb().update(organization).set({ name: parsed.data.name })
    .where(eq(organization.id, tenant.organizationId)).returning({ id: organization.id, name: organization.name });
  await recordActivity(tenant, { action: "workspace.renamed", entityType: "workspace", entityId: updated.id, summary: "renamed the workspace to " + updated.name });
  return c.json({ data: updated });
});

workspaceRoutes.post("/sample-data", async (c) => {
  const tenant = await resolveTenant(c, "workspace:manage");
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const [[cust], [proj], [task]] = await Promise.all([
    database.select({ total: count() }).from(customers).where(eq(customers.organizationId, tenant.organizationId)),
    database.select({ total: count() }).from(projects).where(eq(projects.organizationId, tenant.organizationId)),
    database.select({ total: count() }).from(tasks).where(eq(tasks.organizationId, tenant.organizationId)),
  ]);
  if (Number(cust.total) + Number(proj.total) + Number(task.total) > 0) {
    return c.json({ error: "not_empty", message: "Sample data can only be added to an empty workspace." }, 409);
  }
  await seedWorkspace({ organizationId: tenant.organizationId, ownerId: tenant.userId });
  await recordActivity(tenant, { action: "workspace.sample_data", entityType: "workspace", entityId: tenant.organizationId, summary: "added sample data to explore the workspace" });
  return c.json({ data: { seeded: true } }, 201);
});

workspaceRoutes.get("/dashboard", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const org = tenant.organizationId;
  const now = today();
  const weekEnd = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const [[customerCount], [projectCount], taskStats, upcoming, recent, [docCount]] = await Promise.all([
    database.select({ total: count() }).from(customers).where(and(eq(customers.organizationId, org), isNull(customers.archivedAt))),
    database.select({ total: count(), active: sql<number>`count(*) filter (where ${projects.status} = 'active')` })
      .from(projects).where(and(eq(projects.organizationId, org), isNull(projects.archivedAt))),
    database.select({
      open: sql<number>`count(*) filter (where ${tasks.status} <> 'done')`,
      overdue: sql<number>`count(*) filter (where ${tasks.status} <> 'done' and ${tasks.dueDate} < ${now})`,
      dueWeek: sql<number>`count(*) filter (where ${tasks.status} <> 'done' and ${tasks.dueDate} >= ${now} and ${tasks.dueDate} <= ${weekEnd})`,
      mine: sql<number>`count(*) filter (where ${tasks.status} <> 'done' and ${tasks.assigneeId} = ${tenant.userId})`,
      todo: sql<number>`count(*) filter (where ${tasks.status} = 'todo')`,
      inProgress: sql<number>`count(*) filter (where ${tasks.status} = 'in_progress')`,
      review: sql<number>`count(*) filter (where ${tasks.status} = 'review')`,
      done: sql<number>`count(*) filter (where ${tasks.status} = 'done')`,
      completedWeek: sql<number>`count(*) filter (where ${tasks.completedAt} >= now() - interval '7 days')`,
    }).from(tasks).where(eq(tasks.organizationId, org)),
    database.select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, priority: tasks.priority, status: tasks.status, projectName: projects.name, assigneeName: user.name })
      .from(tasks).leftJoin(projects, and(eq(projects.id, tasks.projectId), eq(projects.organizationId, org))).leftJoin(user, eq(user.id, tasks.assigneeId))
      .where(and(eq(tasks.organizationId, org), ne(tasks.status, "done"), sql`${tasks.dueDate} is not null`))
      .orderBy(tasks.dueDate).limit(6),
    database.select({ id: activity.id, summary: activity.summary, action: activity.action, entityType: activity.entityType, entityId: activity.entityId, createdAt: activity.createdAt, actorName: user.name })
      .from(activity).leftJoin(user, eq(user.id, activity.actorId)).where(eq(activity.organizationId, org)).orderBy(desc(activity.createdAt)).limit(8),
    database.select({ total: count() }).from(documents).where(eq(documents.organizationId, org)),
  ]);
  const t = taskStats[0];
  return c.json({ data: {
    customers: Number(customerCount?.total ?? 0),
    projects: { total: Number(projectCount?.total ?? 0), active: Number(projectCount?.active ?? 0) },
    tasks: {
      open: Number(t.open), overdue: Number(t.overdue), dueThisWeek: Number(t.dueWeek), mine: Number(t.mine), completedThisWeek: Number(t.completedWeek),
      byStatus: { todo: Number(t.todo), in_progress: Number(t.inProgress), review: Number(t.review), done: Number(t.done) },
    },
    documents: Number(docCount?.total ?? 0),
    upcoming: upcoming.map((task) => ({ ...task, overdue: Boolean(task.dueDate && task.dueDate < now) })),
    activity: recent,
  } });
});

workspaceRoutes.get("/activity", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const limit = Math.max(1, Math.min(100, Number.parseInt(c.req.query("limit") ?? "40", 10) || 40));
  const before = c.req.query("before");
  const beforeDate = before ? new Date(before) : null;
  const conditions = [eq(activity.organizationId, tenant.organizationId)];
  if (beforeDate && !Number.isNaN(beforeDate.getTime())) conditions.push(lt(activity.createdAt, beforeDate));
  const rows = await requireDb().select({
    id: activity.id, summary: activity.summary, action: activity.action, entityType: activity.entityType, entityId: activity.entityId,
    createdAt: activity.createdAt, actorName: user.name,
  }).from(activity).leftJoin(user, eq(user.id, activity.actorId)).where(and(...conditions)).orderBy(desc(activity.createdAt)).limit(limit);
  return c.json({ data: rows });
});
