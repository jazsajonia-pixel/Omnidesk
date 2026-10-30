import { and, count, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "./auth.js";
import { requireDb } from "./db/client.js";
import { customers } from "./db/schema.js";
import { trustedOrigins } from "./origins.js";
import { customerRoutes } from "./routes/customers.js";
import { demoRoutes } from "./routes/demo.js";
import { documentRoutes } from "./routes/documents.js";
import { insightRoutes } from "./routes/insights.js";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";
import { invitationRoutes, teamRoutes } from "./routes/team.js";
import { workspaceRoutes } from "./routes/workspace.js";
import { securityHeaders } from "./security-headers.js";
import { isTenantContext, resolveTenant } from "./tenant.js";

export const app = new Hono();
app.use("*", securityHeaders);

/**
 * Reject state-changing requests from untrusted browser origins. Better Auth
 * performs its own origin checks for /api/auth/*.
 */
app.use("/api/*", async (c, next) => {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS" || c.req.path.startsWith("/api/auth/")) return next();
  const origin = c.req.header("origin");
  if (!origin || !trustedOrigins().includes(origin.replace(/\/$/, ""))) {
    return c.json({ error: "forbidden_origin", message: "A trusted origin is required for this request." }, 403);
  }
  return next();
});

app.get("/api/health", (c) => c.json({ status: "ok", service: "omnidesk-api", database: Boolean(process.env.DATABASE_URL) }));
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
  const [row] = await requireDb().select({ customers: count() }).from(customers)
    .where(and(eq(customers.organizationId, tenant.organizationId), isNull(customers.archivedAt)));
  return c.json({ customers: Number(row?.customers ?? 0) });
});

app.route("/api/customers", customerRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/tasks", taskRoutes);
app.route("/api/documents", documentRoutes);
app.route("/api/team", teamRoutes);
app.route("/api/invitations", invitationRoutes);
app.route("/api/workspace", workspaceRoutes);
app.route("/api/demo", demoRoutes);
app.route("/api", insightRoutes);

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((error, c) => {
  console.error("OmniDesk API request failed", { path: c.req.path, method: c.req.method, message: error instanceof Error ? error.message : "unknown" });
  return c.json({ error: "internal_server_error", message: "Something went wrong on our side. Try again." }, 500);
});
