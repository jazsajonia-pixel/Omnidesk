import { randomUUID } from "node:crypto";
import { and, eq, like, lt } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "../auth.js";
import { requireDb } from "../db/client.js";
import { member, organization, session, user } from "../db/schema.js";
import { clientIp, consumeLimit } from "../lib/limit.js";
import { seedWorkspace } from "../seed.js";

export const DEMO_DOMAIN = "demo.omnidesk.invalid";
const DEMO_HOURS = 24;

async function cleanupExpiredDemos() {
  const database = requireDb();
  const cutoff = new Date(Date.now() - DEMO_HOURS * 3_600_000);
  await database.delete(organization).where(and(like(organization.metadata, "%\"demo\":true%"), lt(organization.createdAt, cutoff)));
  await database.delete(user).where(and(like(user.email, "%@" + DEMO_DOMAIN), lt(user.createdAt, cutoff)));
}

export const demoRoutes = new Hono();

/**
 * Create a private, temporary demo workspace with sample data and sign the
 * visitor in. Demo accounts and workspaces are deleted after 24 hours.
 */
demoRoutes.post("/", async (c) => {
  if (process.env.DEMO_ENABLED === "false") return c.json({ error: "disabled", message: "The demo is turned off." }, 403);
  const ip = clientIp(c.req.raw.headers);
  const [perIp, global] = await Promise.all([consumeLimit("demo:" + ip, 6, 3600), consumeLimit("demo:global", 200, 3600)]);
  if (!perIp.allowed || !global.allowed) return c.json({ error: "rate_limited", message: "Too many demo workspaces were created. Try again in an hour." }, 429);
  try { await cleanupExpiredDemos(); } catch (error) { console.error("OmniDesk demo cleanup failed", error instanceof Error ? error.message : error); }

  const short = randomUUID().slice(0, 8);
  const password = randomUUID() + randomUUID();
  const { headers, response } = await auth.api.signUpEmail({
    body: { name: "Demo Visitor", email: "visitor-" + short + "@" + DEMO_DOMAIN, password },
    headers: c.req.raw.headers,
    returnHeaders: true,
  });
  const database = requireDb();
  const visitorId = response.user.id;
  const organizationId = randomUUID();
  const teammates = [
    { id: randomUUID(), name: "Maya Santos", email: "maya-" + short + "@" + DEMO_DOMAIN },
    { id: randomUUID(), name: "Leo Cruz", email: "leo-" + short + "@" + DEMO_DOMAIN },
  ];
  await database.insert(user).values(teammates.map((t) => ({ ...t, emailVerified: false })));
  await database.insert(organization).values({
    id: organizationId, name: "Northwind Studio (demo)", slug: "northwind-demo-" + short, metadata: JSON.stringify({ demo: true }),
  });
  await database.insert(member).values([
    { id: randomUUID(), organizationId, userId: visitorId, role: "owner" },
    { id: randomUUID(), organizationId, userId: teammates[0].id, role: "manager" },
    { id: randomUUID(), organizationId, userId: teammates[1].id, role: "member" },
  ]);
  if (response.token) {
    await database.update(session).set({ activeOrganizationId: organizationId })
      .where(and(eq(session.userId, visitorId), eq(session.token, response.token)));
  } else {
    await database.update(session).set({ activeOrganizationId: organizationId }).where(eq(session.userId, visitorId));
  }
  await seedWorkspace({ organizationId, ownerId: visitorId, teammateIds: teammates.map((t) => t.id) });

  for (const cookie of headers.getSetCookie()) c.header("Set-Cookie", cookie, { append: true });
  return c.json({ data: { organizationId, expiresInHours: DEMO_HOURS } }, 201);
});
