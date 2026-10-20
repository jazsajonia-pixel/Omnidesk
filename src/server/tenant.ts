import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { auth } from "./auth";
import { requireDb } from "./db/client";
import { member } from "./db/schema";
import type { TenantContext } from "./tenant-context";
export { isTenantContext, type TenantContext } from "./tenant-context";

export async function resolveTenant(c: Context): Promise<TenantContext | Response> {
  const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sessionData) return c.json({ error: "unauthorized", message: "Sign in is required." }, 401);
  const organizationId = sessionData.session.activeOrganizationId;
  if (!organizationId) return c.json({ error: "organization_required", message: "Choose or create a workspace first." }, 403);
  const database = requireDb();
  const [membership] = await database.select({
    organizationId: member.organizationId, role: member.role,
  }).from(member).where(and(
    eq(member.organizationId, organizationId), eq(member.userId, sessionData.user.id),
  )).limit(1);
  if (!membership) return c.json({ error: "forbidden", message: "You are not a member of this workspace." }, 403);
  return { userId: sessionData.user.id, organizationId: membership.organizationId, role: membership.role };
}
