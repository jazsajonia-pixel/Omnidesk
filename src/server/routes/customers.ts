import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { requireDb } from "../db/client.js";
import { customerNotes, customers, projects, user } from "../db/schema.js";
import { recordActivity } from "../lib/activity.js";
import { forbidden, likePattern, notFound, pageParams, parseBody, searchParam } from "../lib/http.js";
import { can } from "../permissions.js";
import { isTenantContext, resolveTenant } from "../tenant.js";

export const CUSTOMER_STATUSES = ["lead", "active", "inactive"] as const;

const customerInput = z.object({
  name: z.string().trim().min(1, "Customer name is required.").max(160),
  email: z.string().trim().email("Enter a valid email address.").max(254).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  status: z.enum(CUSTOMER_STATUSES).optional(),
}).strict();
const customerUpdateInput = customerInput.partial().strict();
const noteInput = z.object({ body: z.string().trim().min(1, "Write a note first.").max(4000) }).strict();

const columns = {
  id: customers.id, name: customers.name, email: customers.email, company: customers.company,
  phone: customers.phone, status: customers.status,
  createdAt: customers.createdAt, updatedAt: customers.updatedAt, archivedAt: customers.archivedAt,
};

export const customerRoutes = new Hono();

customerRoutes.get("/", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const { page: requestedPage, pageSize } = pageParams(c, 10, 50);
  const search = searchParam(c);
  const archived = c.req.query("archived") === "true";
  const status = c.req.query("status");
  const conditions = [
    eq(customers.organizationId, tenant.organizationId),
    archived ? isNotNull(customers.archivedAt) : isNull(customers.archivedAt),
  ];
  if (status && (CUSTOMER_STATUSES as readonly string[]).includes(status)) conditions.push(eq(customers.status, status));
  if (search) {
    const pattern = likePattern(search);
    conditions.push(or(ilike(customers.name, pattern), ilike(customers.email, pattern), ilike(customers.company, pattern))!);
  }
  const whereClause = and(...conditions);
  const database = requireDb();
  const [summary] = await database.select({ total: count() }).from(customers).where(whereClause);
  const total = Number(summary?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize);
  const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const rows = await database.select(columns).from(customers).where(whereClause)
    .orderBy(desc(customers.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  const ids = rows.map((row) => row.id);
  const projectCounts = ids.length ? await database.select({ customerId: projects.customerId, total: count() })
    .from(projects).where(and(eq(projects.organizationId, tenant.organizationId), inArray(projects.customerId, ids), isNull(projects.archivedAt)))
    .groupBy(projects.customerId) : [];
  const countMap = new Map(projectCounts.map((row) => [row.customerId, Number(row.total)]));
  return c.json({
    data: rows.map((row) => ({ ...row, projectCount: countMap.get(row.id) ?? 0 })),
    pagination: { page, pageSize, total, totalPages },
  });
});

customerRoutes.get("/options", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const rows = await requireDb().select({ id: customers.id, name: customers.name, company: customers.company })
    .from(customers).where(and(eq(customers.organizationId, tenant.organizationId), isNull(customers.archivedAt)))
    .orderBy(customers.name).limit(500);
  return c.json({ data: rows });
});

customerRoutes.get("/:id", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const [row] = await database.select(columns).from(customers).where(and(
    eq(customers.id, c.req.param("id")), eq(customers.organizationId, tenant.organizationId), isNull(customers.archivedAt),
  )).limit(1);
  if (!row) return notFound(c, "Customer");
  const notes = await database.select({
    id: customerNotes.id, body: customerNotes.body, createdAt: customerNotes.createdAt,
    authorId: customerNotes.authorId, authorName: user.name,
  }).from(customerNotes).leftJoin(user, eq(user.id, customerNotes.authorId))
    .where(and(eq(customerNotes.organizationId, tenant.organizationId), eq(customerNotes.customerId, row.id)))
    .orderBy(desc(customerNotes.createdAt)).limit(100);
  const linkedProjects = await database.select({
    id: projects.id, name: projects.name, status: projects.status, dueDate: projects.dueDate,
  }).from(projects).where(and(eq(projects.organizationId, tenant.organizationId), eq(projects.customerId, row.id), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt)).limit(50);
  return c.json({ data: { ...row, notes, projects: linkedProjects } });
});

customerRoutes.post("/", async (c) => {
  const tenant = await resolveTenant(c, "customer:write");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, customerInput);
  if (parsed.ok === false) return parsed.response;
  const [created] = await requireDb().insert(customers).values({
    id: randomUUID(), organizationId: tenant.organizationId, name: parsed.data.name,
    email: parsed.data.email || null, company: parsed.data.company || null,
    phone: parsed.data.phone || null, status: parsed.data.status ?? "active",
  }).returning(columns);
  await recordActivity(tenant, { action: "customer.created", entityType: "customer", entityId: created.id, summary: "added customer " + created.name });
  return c.json({ data: created }, 201);
});

customerRoutes.patch("/:id", async (c) => {
  const tenant = await resolveTenant(c, "customer:write");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, customerUpdateInput);
  if (parsed.ok === false) return parsed.response;
  if (Object.keys(parsed.data).length === 0) return c.json({ error: "validation_error", message: "Change at least one field." }, 400);
  const values: Partial<typeof customers.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) values.name = parsed.data.name;
  if (parsed.data.email !== undefined) values.email = parsed.data.email || null;
  if (parsed.data.company !== undefined) values.company = parsed.data.company || null;
  if (parsed.data.phone !== undefined) values.phone = parsed.data.phone || null;
  if (parsed.data.status !== undefined) values.status = parsed.data.status;
  const [updated] = await requireDb().update(customers).set(values).where(and(
    eq(customers.id, c.req.param("id")), eq(customers.organizationId, tenant.organizationId), isNull(customers.archivedAt),
  )).returning(columns);
  if (!updated) return notFound(c, "Customer");
  await recordActivity(tenant, { action: "customer.updated", entityType: "customer", entityId: updated.id, summary: "updated customer " + updated.name });
  return c.json({ data: updated });
});

async function setArchived(c: Context, archived: boolean) {
  const tenant = await resolveTenant(c, "customer:write");
  if (!isTenantContext(tenant)) return tenant;
  const [updated] = await requireDb().update(customers).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() }).where(and(
    eq(customers.id, c.req.param("id") ?? ""), eq(customers.organizationId, tenant.organizationId),
    archived ? isNull(customers.archivedAt) : isNotNull(customers.archivedAt),
  )).returning({ id: customers.id, name: customers.name, archivedAt: customers.archivedAt });
  if (!updated) return c.json({ error: "not_found", message: "Customer not found in this list." }, 404);
  await recordActivity(tenant, {
    action: archived ? "customer.archived" : "customer.restored", entityType: "customer", entityId: updated.id,
    summary: (archived ? "archived customer " : "restored customer ") + updated.name,
  });
  return c.json({ data: updated });
}
customerRoutes.post("/:id/archive", (c) => setArchived(c, true));
customerRoutes.post("/:id/restore", (c) => setArchived(c, false));

customerRoutes.post("/:id/notes", async (c) => {
  const tenant = await resolveTenant(c, "note:write");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, noteInput);
  if (parsed.ok === false) return parsed.response;
  const database = requireDb();
  const [customer] = await database.select({ id: customers.id, name: customers.name }).from(customers).where(and(
    eq(customers.id, c.req.param("id")), eq(customers.organizationId, tenant.organizationId), isNull(customers.archivedAt),
  )).limit(1);
  if (!customer) return notFound(c, "Customer");
  const [note] = await database.insert(customerNotes).values({
    id: randomUUID(), organizationId: tenant.organizationId, customerId: customer.id, authorId: tenant.userId, body: parsed.data.body,
  }).returning({ id: customerNotes.id, body: customerNotes.body, createdAt: customerNotes.createdAt, authorId: customerNotes.authorId });
  await database.update(customers).set({ updatedAt: sql`now()` }).where(eq(customers.id, customer.id));
  await recordActivity(tenant, { action: "customer.note_added", entityType: "customer", entityId: customer.id, summary: "added a note to " + customer.name });
  return c.json({ data: { ...note, authorName: tenant.userName } }, 201);
});

customerRoutes.delete("/:id/notes/:noteId", async (c) => {
  const tenant = await resolveTenant(c, "note:write");
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const [note] = await database.select({ id: customerNotes.id, authorId: customerNotes.authorId }).from(customerNotes).where(and(
    eq(customerNotes.id, c.req.param("noteId")), eq(customerNotes.customerId, c.req.param("id")),
    eq(customerNotes.organizationId, tenant.organizationId),
  )).limit(1);
  if (!note) return notFound(c, "Note");
  if (note.authorId !== tenant.userId && !can(tenant.role, "customer:write")) return forbidden(c, "Only the author or a manager can delete this note.");
  await database.delete(customerNotes).where(and(eq(customerNotes.id, note.id), eq(customerNotes.organizationId, tenant.organizationId)));
  return c.json({ data: { id: note.id } });
});
