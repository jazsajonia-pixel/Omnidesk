import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
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

app.get("/api/customers", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const rows = await database.select({
    id: customers.id, name: customers.name, email: customers.email,
    company: customers.company, createdAt: customers.createdAt,
  }).from(customers).where(eq(customers.organizationId, tenant.organizationId))
    .orderBy(desc(customers.createdAt)).limit(100);
  return c.json({ data: rows });
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
    id: customers.id, name: customers.name, email: customers.email,
    company: customers.company, createdAt: customers.createdAt,
  });
  return c.json({ data: created }, 201);
});

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((error, c) => {
  console.error("OmniDesk API request failed", error);
  return c.json({ error: "internal_server_error" }, 500);
});
