import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "./auth";
import { requireDb } from "./db/client";
import { customers } from "./db/schema";
import { isTenantContext, resolveTenant } from "./tenant";

const customerInput = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional(),
}).strict();
const customerUpdateInput = customerInput.partial().strict();

export const app = new Hono();
app.get("/api/health", (c) => c.json({ status: "ok", service: "omnidesk-api" }));
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/api/me", async (c) => {
  const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sessionData) return c.json({ authenticated: false }, 401);
  return c.json({
    authenticated: true,
    user: { id: sessionData.user.id, name: sessionData.user.name, email: sessionData.user.email },
    activeOrganizationId: sessionData.session.activeOrganizationId ?? null,
  });
});

app.get("/api/dashboard/summary", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const [row] = await database.select({ customers: count() }).from(customers)
    .where(and(eq(customers.organizationId, tenant.organizationId), isNull(customers.archivedAt)));
  return c.json({ customers: Number(row?.customers ?? 0) });
});

app.get("/api/customers", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const page = Math.max(1, Math.min(100_000, Number.parseInt(c.req.query("page") ?? "1", 10) || 1));
  const pageSize = Math.max(1, Math.min(50, Number.parseInt(c.req.query("pageSize") ?? "10", 10) || 10));
  const search = (c.req.query("search") ?? "").trim().slice(0, 120);
  const archived = c.req.query("archived") === "true";
  const conditions = [
    eq(customers.organizationId, tenant.organizationId),
    archived ? isNotNull(customers.archivedAt) : isNull(customers.archivedAt),
  ];
  if (search) {
    conditions.push(or(
      ilike(customers.name, "%" + search + "%"),
      ilike(customers.email, "%" + search + "%"),
      ilike(customers.company, "%" + search + "%"),
    )!);
  }
  const whereClause = and(...conditions);
  const database = requireDb();
  const [summary] = await database.select({ total: count() }).from(customers).where(whereClause);
  const rows = await database.select({
    id: customers.id, name: customers.name, email: customers.email,
    company: customers.company, createdAt: customers.createdAt, updatedAt: customers.updatedAt,
    archivedAt: customers.archivedAt,
  }).from(customers).where(whereClause).orderBy(desc(customers.createdAt))
    .limit(pageSize).offset((page - 1) * pageSize);
  const total = Number(summary?.total ?? 0);
  return c.json({ data: rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
});

app.get("/api/customers/:id", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const [row] = await database.select({
    id: customers.id, name: customers.name, email: customers.email, company: customers.company,
    createdAt: customers.createdAt, updatedAt: customers.updatedAt, archivedAt: customers.archivedAt,
  }).from(customers).where(and(
    eq(customers.id, c.req.param("id")),
    eq(customers.organizationId, tenant.organizationId),
    isNull(customers.archivedAt),
  )).limit(1);
  if (!row) return c.json({ error: "not_found", message: "Customer not found." }, 404);
  return c.json({ data: row });
});

app.post("/api/customers", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  let body: unknown;
  try { body = await c.req.json(); }
  catch { return c.json({ error: "invalid_json", message: "Request body must be valid JSON." }, 400); }
  const parsed = customerInput.safeParse(body);
  if (!parsed.success) return c.json({
    error: "validation_error",
    issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  }, 400);
  const database = requireDb();
  const [created] = await database.insert(customers).values({
    id: randomUUID(), organizationId: tenant.organizationId, name: parsed.data.name,
    email: parsed.data.email || null, company: parsed.data.company || null,
  }).returning({
    id: customers.id, name: customers.name, email: customers.email, company: customers.company,
    createdAt: customers.createdAt, updatedAt: customers.updatedAt, archivedAt: customers.archivedAt,
  });
  return c.json({ data: created }, 201);
});

app.patch("/api/customers/:id", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  let body: unknown;
  try { body = await c.req.json(); }
  catch { return c.json({ error: "invalid_json", message: "Request body must be valid JSON." }, 400); }
  const parsed = customerUpdateInput.safeParse(body);
  if (!parsed.success) return c.json({
    error: "validation_error",
    issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  }, 400);
  if (Object.keys(parsed.data).length === 0) return c.json({ error: "validation_error", message: "Change at least one field." }, 400);

  const values: Partial<typeof customers.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) values.name = parsed.data.name;
  if (parsed.data.email !== undefined) values.email = parsed.data.email || null;
  if (parsed.data.company !== undefined) values.company = parsed.data.company || null;

  const database = requireDb();
  const [updated] = await database.update(customers).set(values).where(and(
    eq(customers.id, c.req.param("id")),
    eq(customers.organizationId, tenant.organizationId),
    isNull(customers.archivedAt),
  )).returning({
    id: customers.id, name: customers.name, email: customers.email, company: customers.company,
    createdAt: customers.createdAt, updatedAt: customers.updatedAt, archivedAt: customers.archivedAt,
  });
  if (!updated) return c.json({ error: "not_found", message: "Customer not found." }, 404);
  return c.json({ data: updated });
});

async function setCustomerArchived(c: Context, archived: boolean) {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const [updated] = await database.update(customers).set({
    archivedAt: archived ? new Date() : null,
    updatedAt: new Date(),
  }).where(and(
    eq(customers.id, c.req.param("id")),
    eq(customers.organizationId, tenant.organizationId),
    archived ? isNull(customers.archivedAt) : isNotNull(customers.archivedAt),
  )).returning({ id: customers.id, name: customers.name, archivedAt: customers.archivedAt });
  if (!updated) return c.json({ error: "not_found", message: "Customer not found in this list." }, 404);
  return c.json({ data: updated });
}
app.post("/api/customers/:id/archive", (c) => setCustomerArchived(c, true));
app.post("/api/customers/:id/restore", (c) => setCustomerArchived(c, false));

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((error, c) => {
  console.error("OmniDesk API request failed", error);
  return c.json({ error: "internal_server_error" }, 500);
});
