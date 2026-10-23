import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, ilike, isNull, lt, lte, max, ne, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireDb } from "../db/client.js";
import { member, projects, tasks, user } from "../db/schema.js";
import { recordActivity } from "../lib/activity.js";
import { forbidden, isoDate, likePattern, notFound, parseBody, searchParam, today } from "../lib/http.js";
import { can } from "../permissions.js";
import { isTenantContext, resolveTenant } from "../tenant.js";
import type { TenantContext } from "../tenant-context.js";

export const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const statusLabel: Record<string, string> = { todo: "To do", in_progress: "In progress", review: "In review", done: "Done" };

const taskInput = z.object({
  title: z.string().trim().min(1, "Task title is required.").max(200),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  projectId: z.string().trim().max(64).nullable().optional(),
  assigneeId: z.string().trim().max(64).nullable().optional(),
  dueDate: z.string().regex(isoDate, "Use a valid date.").nullable().optional().or(z.literal("")),
}).strict();
const taskUpdateInput = taskInput.partial().strict();
// `beforeId` / `afterId` anchor the drop next to a visible card. Stored positions can have
// gaps (deletes, status edits), so anchors are preferred; `position` is the fallback index.
const moveInput = z.object({
  status: z.enum(TASK_STATUSES),
  position: z.number().int().min(0).max(100_000).optional(),
  beforeId: z.string().min(1).max(100).nullish(),
  afterId: z.string().min(1).max(100).nullish(),
}).strict();

const columns = {
  id: tasks.id, title: tasks.title, description: tasks.description, status: tasks.status, priority: tasks.priority,
  projectId: tasks.projectId, projectName: projects.name, assigneeId: tasks.assigneeId, assigneeName: user.name,
  dueDate: tasks.dueDate, position: tasks.position, createdAt: tasks.createdAt, updatedAt: tasks.updatedAt, completedAt: tasks.completedAt,
};

async function validateRefs(tenant: TenantContext, data: { projectId?: string | null; assigneeId?: string | null }) {
  const database = requireDb();
  if (data.projectId) {
    const [row] = await database.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.organizationId, tenant.organizationId))).limit(1);
    if (!row) return "Choose a project from this workspace.";
  }
  if (data.assigneeId) {
    const [row] = await database.select({ id: member.id }).from(member)
      .where(and(eq(member.userId, data.assigneeId), eq(member.organizationId, tenant.organizationId))).limit(1);
    if (!row) return "Assign the task to a member of this workspace.";
  }
  return null;
}

async function nextPosition(organizationId: string, status: string) {
  const [row] = await requireDb().select({ value: max(tasks.position) }).from(tasks)
    .where(and(eq(tasks.organizationId, organizationId), eq(tasks.status, status)));
  return (row?.value ?? -1) + 1;
}

export const taskRoutes = new Hono();

taskRoutes.get("/", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const conditions: SQL[] = [eq(tasks.organizationId, tenant.organizationId)];
  const search = searchParam(c);
  if (search) conditions.push(ilike(tasks.title, likePattern(search)));
  const projectId = c.req.query("projectId");
  if (projectId === "none") conditions.push(isNull(tasks.projectId));
  else if (projectId) conditions.push(eq(tasks.projectId, projectId));
  const assignee = c.req.query("assignee");
  if (assignee === "me") conditions.push(eq(tasks.assigneeId, tenant.userId));
  else if (assignee === "none") conditions.push(isNull(tasks.assigneeId));
  else if (assignee) conditions.push(eq(tasks.assigneeId, assignee));
  const priority = c.req.query("priority");
  if (priority && (TASK_PRIORITIES as readonly string[]).includes(priority)) conditions.push(eq(tasks.priority, priority));
  const status = c.req.query("status");
  if (status && (TASK_STATUSES as readonly string[]).includes(status)) conditions.push(eq(tasks.status, status));
  const due = c.req.query("due");
  if (due === "overdue") conditions.push(lt(tasks.dueDate, today()), ne(tasks.status, "done"));
  if (due === "week") {
    const end = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    conditions.push(gte(tasks.dueDate, today()), lte(tasks.dueDate, end), ne(tasks.status, "done"));
  }
  const rows = await requireDb().select(columns).from(tasks)
    .leftJoin(projects, and(eq(projects.id, tasks.projectId), eq(projects.organizationId, tenant.organizationId)))
    .leftJoin(user, eq(user.id, tasks.assigneeId))
    .where(and(...conditions)).orderBy(asc(tasks.position), asc(tasks.createdAt)).limit(500);
  return c.json({ data: rows });
});

taskRoutes.get("/:id", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const [row] = await requireDb().select(columns).from(tasks)
    .leftJoin(projects, and(eq(projects.id, tasks.projectId), eq(projects.organizationId, tenant.organizationId)))
    .leftJoin(user, eq(user.id, tasks.assigneeId))
    .where(and(eq(tasks.id, c.req.param("id")), eq(tasks.organizationId, tenant.organizationId))).limit(1);
  if (!row) return notFound(c, "Task");
  return c.json({ data: row });
});

taskRoutes.post("/", async (c) => {
  const tenant = await resolveTenant(c, "task:write");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, taskInput);
  if (!parsed.ok) return parsed.response;
  const refError = await validateRefs(tenant, parsed.data);
  if (refError) return c.json({ error: "validation_error", message: refError }, 400);
  const status = parsed.data.status ?? "todo";
  const [created] = await requireDb().insert(tasks).values({
    id: randomUUID(), organizationId: tenant.organizationId, title: parsed.data.title,
    description: parsed.data.description || null, status, priority: parsed.data.priority ?? "medium",
    projectId: parsed.data.projectId || null, assigneeId: parsed.data.assigneeId || null,
    dueDate: parsed.data.dueDate || null, position: await nextPosition(tenant.organizationId, status),
    createdBy: tenant.userId, completedAt: status === "done" ? new Date() : null,
  }).returning({ id: tasks.id, title: tasks.title });
  await recordActivity(tenant, { action: "task.created", entityType: "task", entityId: created.id, summary: "created task " + created.title });
  return c.json({ data: created }, 201);
});

taskRoutes.patch("/:id", async (c) => {
  const tenant = await resolveTenant(c, "task:write");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, taskUpdateInput);
  if (!parsed.ok) return parsed.response;
  if (Object.keys(parsed.data).length === 0) return c.json({ error: "validation_error", message: "Change at least one field." }, 400);
  const refError = await validateRefs(tenant, parsed.data);
  if (refError) return c.json({ error: "validation_error", message: refError }, 400);
  const database = requireDb();
  const [existing] = await database.select({ id: tasks.id, status: tasks.status }).from(tasks)
    .where(and(eq(tasks.id, c.req.param("id")), eq(tasks.organizationId, tenant.organizationId))).limit(1);
  if (!existing) return notFound(c, "Task");
  const values: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) values.title = parsed.data.title;
  if (parsed.data.description !== undefined) values.description = parsed.data.description || null;
  if (parsed.data.priority !== undefined) values.priority = parsed.data.priority;
  if (parsed.data.projectId !== undefined) values.projectId = parsed.data.projectId || null;
  if (parsed.data.assigneeId !== undefined) values.assigneeId = parsed.data.assigneeId || null;
  if (parsed.data.dueDate !== undefined) values.dueDate = parsed.data.dueDate || null;
  if (parsed.data.status !== undefined && parsed.data.status !== existing.status) {
    values.status = parsed.data.status;
    values.position = await nextPosition(tenant.organizationId, parsed.data.status);
    values.completedAt = parsed.data.status === "done" ? new Date() : null;
  }
  const [updated] = await database.update(tasks).set(values)
    .where(and(eq(tasks.id, existing.id), eq(tasks.organizationId, tenant.organizationId)))
    .returning({ id: tasks.id, title: tasks.title, status: tasks.status });
  const summary = values.status ? "moved " + updated.title + " to " + statusLabel[updated.status] : "updated task " + updated.title;
  await recordActivity(tenant, { action: values.status === "done" ? "task.completed" : "task.updated", entityType: "task", entityId: updated.id, summary: values.status === "done" ? "completed " + updated.title : summary });
  return c.json({ data: updated });
});

/** Move a task to a column and index; other tasks in that column are re-sequenced. */
taskRoutes.post("/:id/move", async (c) => {
  const tenant = await resolveTenant(c, "task:write");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, moveInput);
  if (!parsed.ok) return parsed.response;
  const database = requireDb();
  const result = await database.transaction(async (tx) => {
    const [existing] = await tx.select({ id: tasks.id, status: tasks.status, title: tasks.title }).from(tasks)
      .where(and(eq(tasks.id, c.req.param("id")), eq(tasks.organizationId, tenant.organizationId))).limit(1).for("update");
    if (!existing) return null;
    const column = await tx.select({ id: tasks.id }).from(tasks)
      .where(and(eq(tasks.organizationId, tenant.organizationId), eq(tasks.status, parsed.data.status), ne(tasks.id, existing.id)))
      .orderBy(asc(tasks.position), asc(tasks.createdAt));
    const ordered = column.map((row) => row.id);
    const beforeIndex = parsed.data.beforeId ? ordered.indexOf(parsed.data.beforeId) : -1;
    const afterIndex = parsed.data.afterId ? ordered.indexOf(parsed.data.afterId) : -1;
    const insertAt = beforeIndex >= 0 ? beforeIndex
      : afterIndex >= 0 ? afterIndex + 1
      : Math.min(parsed.data.position ?? ordered.length, ordered.length);
    ordered.splice(insertAt, 0, existing.id);
    if (ordered.length) {
      const cases = sql.join(ordered.map((id, index) => sql`when ${id} then ${index}::integer`), sql` `);
      await tx.update(tasks).set({ position: sql`case ${tasks.id} ${cases} end` })
        .where(and(eq(tasks.organizationId, tenant.organizationId), sql`${tasks.id} in (${sql.join(ordered.map((id) => sql`${id}`), sql`, `)})`));
    }
    const statusChanged = existing.status !== parsed.data.status;
    await tx.update(tasks).set({
      status: parsed.data.status, updatedAt: new Date(),
      ...(statusChanged ? { completedAt: parsed.data.status === "done" ? new Date() : null } : {}),
    }).where(and(eq(tasks.id, existing.id), eq(tasks.organizationId, tenant.organizationId)));
    return { ...existing, statusChanged };
  });
  if (!result) return notFound(c, "Task");
  if (result.statusChanged) {
    await recordActivity(tenant, {
      action: parsed.data.status === "done" ? "task.completed" : "task.moved", entityType: "task", entityId: result.id,
      summary: parsed.data.status === "done" ? "completed " + result.title : "moved " + result.title + " to " + statusLabel[parsed.data.status],
    });
  }
  return c.json({ data: { id: result.id, status: parsed.data.status } });
});

taskRoutes.delete("/:id", async (c) => {
  const tenant = await resolveTenant(c, "task:write");
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const [existing] = await database.select({ id: tasks.id, title: tasks.title, createdBy: tasks.createdBy }).from(tasks)
    .where(and(eq(tasks.id, c.req.param("id")), eq(tasks.organizationId, tenant.organizationId))).limit(1);
  if (!existing) return notFound(c, "Task");
  if (existing.createdBy !== tenant.userId && !can(tenant.role, "project:write")) return forbidden(c, "Only the task creator or a manager can delete this task.");
  await database.delete(tasks).where(and(eq(tasks.id, existing.id), eq(tasks.organizationId, tenant.organizationId)));
  await recordActivity(tenant, { action: "task.deleted", entityType: "task", entityId: existing.id, summary: "deleted task " + existing.title });
  return c.json({ data: { id: existing.id } });
});
