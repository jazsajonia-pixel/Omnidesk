import { and, count, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { requireDb } from "../db/client.js";
import { customers, documents, projects, tasks, user } from "../db/schema.js";
import { toCsv } from "../lib/csv.js";
import { likePattern, searchParam } from "../lib/http.js";
import { isTenantContext, resolveTenant } from "../tenant.js";

export const insightRoutes = new Hono();

insightRoutes.get("/search", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const q = searchParam(c, "q");
  if (q.length < 2) return c.json({ data: { customers: [], projects: [], tasks: [], documents: [] } });
  const pattern = likePattern(q);
  const org = tenant.organizationId;
  const database = requireDb();
  const [customerRows, projectRows, taskRows, documentRows] = await Promise.all([
    database.select({ id: customers.id, title: customers.name, subtitle: customers.company }).from(customers)
      .where(and(eq(customers.organizationId, org), isNull(customers.archivedAt), or(ilike(customers.name, pattern), ilike(customers.email, pattern), ilike(customers.company, pattern)))).limit(5),
    database.select({ id: projects.id, title: projects.name, subtitle: projects.status }).from(projects)
      .where(and(eq(projects.organizationId, org), isNull(projects.archivedAt), or(ilike(projects.name, pattern), ilike(projects.description, pattern)))).limit(5),
    database.select({ id: tasks.id, title: tasks.title, subtitle: tasks.status }).from(tasks)
      .where(and(eq(tasks.organizationId, org), or(ilike(tasks.title, pattern), ilike(tasks.description, pattern)))).limit(6),
    database.select({ id: documents.id, title: documents.title, subtitle: sql<string>`'Document'` }).from(documents)
      .where(and(eq(documents.organizationId, org), or(ilike(documents.title, pattern), ilike(documents.body, pattern)))).limit(5),
  ]);
  return c.json({ data: { customers: customerRows, projects: projectRows, tasks: taskRows, documents: documentRows } });
});

insightRoutes.get("/reports", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const org = tenant.organizationId;
  const database = requireDb();
  const weeks = 8;
  const [byStatus, byPriority, created, completed, projectRows, workload, customerStatus] = await Promise.all([
    database.select({ key: tasks.status, total: count() }).from(tasks).where(eq(tasks.organizationId, org)).groupBy(tasks.status),
    database.select({ key: tasks.priority, total: count() }).from(tasks).where(and(eq(tasks.organizationId, org), ne(tasks.status, "done"))).groupBy(tasks.priority),
    database.select({ week: sql<string>`to_char(date_trunc('week', ${tasks.createdAt}), 'YYYY-MM-DD')`, total: count() }).from(tasks)
      .where(and(eq(tasks.organizationId, org), sql`${tasks.createdAt} >= date_trunc('week', now()) - interval '${sql.raw(String(weeks - 1))} weeks'`)).groupBy(sql`1`),
    database.select({ week: sql<string>`to_char(date_trunc('week', ${tasks.completedAt}), 'YYYY-MM-DD')`, total: count() }).from(tasks)
      .where(and(eq(tasks.organizationId, org), sql`${tasks.completedAt} >= date_trunc('week', now()) - interval '${sql.raw(String(weeks - 1))} weeks'`)).groupBy(sql`1`),
    database.select({
      id: projects.id, name: projects.name, status: projects.status, dueDate: projects.dueDate,
      // Fully qualified: inside a correlated subquery drizzle renders bare column names, so "id" would bind to tasks.id.
      total: sql<number>`(select count(*) from "tasks" t where t."project_id" = "projects"."id" and t."organization_id" = ${org})`,
      done: sql<number>`(select count(*) from "tasks" t where t."project_id" = "projects"."id" and t."organization_id" = ${org} and t."status" = 'done')`,
    }).from(projects).where(and(eq(projects.organizationId, org), isNull(projects.archivedAt))).orderBy(desc(projects.updatedAt)).limit(12),
    database.select({ name: sql<string>`coalesce(${user.name}, 'Unassigned')`, total: count() }).from(tasks).leftJoin(user, eq(user.id, tasks.assigneeId))
      .where(and(eq(tasks.organizationId, org), ne(tasks.status, "done"))).groupBy(sql`1`).orderBy(desc(count())).limit(10),
    database.select({ key: customers.status, total: count() }).from(customers).where(and(eq(customers.organizationId, org), isNull(customers.archivedAt))).groupBy(customers.status),
  ]);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7) - (weeks - 1) * 7);
  const createdMap = new Map(created.map((row) => [row.week, Number(row.total)]));
  const completedMap = new Map(completed.map((row) => [row.week, Number(row.total)]));
  const trend = Array.from({ length: weeks }, (_, index) => {
    const week = new Date(start.getTime() + index * 7 * 86_400_000).toISOString().slice(0, 10);
    return { week, created: createdMap.get(week) ?? 0, completed: completedMap.get(week) ?? 0 };
  });
  const toRecord = (rows: { key: string; total: number }[]) => Object.fromEntries(rows.map((row) => [row.key, Number(row.total)]));
  return c.json({ data: {
    tasksByStatus: toRecord(byStatus), openByPriority: toRecord(byPriority), trend,
    projects: projectRows.map((row) => ({ ...row, total: Number(row.total), done: Number(row.done) })),
    workload: workload.map((row) => ({ name: row.name, total: Number(row.total) })),
    customersByStatus: toRecord(customerStatus),
  } });
});

insightRoutes.get("/export/:entity", async (c) => {
  const tenant = await resolveTenant(c, "data:export");
  if (!isTenantContext(tenant)) return tenant;
  const entity = c.req.param("entity").replace(/\.csv$/, "");
  const org = tenant.organizationId;
  const database = requireDb();
  let csv: string;
  if (entity === "customers") {
    const rows = await database.select().from(customers).where(and(eq(customers.organizationId, org), isNull(customers.archivedAt))).orderBy(customers.name);
    csv = toCsv(["Name", "Email", "Company", "Phone", "Status", "Created"], rows.map((r) => [r.name, r.email, r.company, r.phone, r.status, r.createdAt]));
  } else if (entity === "projects") {
    const rows = await database.select({ name: projects.name, status: projects.status, dueDate: projects.dueDate, customer: customers.name, createdAt: projects.createdAt })
      .from(projects).leftJoin(customers, and(eq(customers.id, projects.customerId), eq(customers.organizationId, org)))
      .where(and(eq(projects.organizationId, org), isNull(projects.archivedAt))).orderBy(projects.name);
    csv = toCsv(["Name", "Status", "Due date", "Customer", "Created"], rows.map((r) => [r.name, r.status, r.dueDate, r.customer, r.createdAt]));
  } else if (entity === "tasks") {
    const rows = await database.select({ title: tasks.title, status: tasks.status, priority: tasks.priority, dueDate: tasks.dueDate, project: projects.name, assignee: user.name, completedAt: tasks.completedAt })
      .from(tasks).leftJoin(projects, and(eq(projects.id, tasks.projectId), eq(projects.organizationId, org))).leftJoin(user, eq(user.id, tasks.assigneeId))
      .where(eq(tasks.organizationId, org)).orderBy(tasks.status, tasks.position);
    csv = toCsv(["Title", "Status", "Priority", "Due date", "Project", "Assignee", "Completed"], rows.map((r) => [r.title, r.status, r.priority, r.dueDate, r.project, r.assignee, r.completedAt]));
  } else {
    return c.json({ error: "not_found", message: "Unknown export." }, 404);
  }
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": "attachment; filename=\"omnidesk-" + entity + "-" + new Date().toISOString().slice(0, 10) + ".csv\"",
  });
});
