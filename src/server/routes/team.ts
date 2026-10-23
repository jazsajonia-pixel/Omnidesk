import { randomUUID } from "node:crypto";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../auth.js";
import { requireDb } from "../db/client.js";
import { invitation, member, organization, user } from "../db/schema.js";
import { recordActivity } from "../lib/activity.js";
import { forbidden, notFound, parseBody } from "../lib/http.js";
import { can, canManageRole, normalizeRole, permissionsFor } from "../permissions.js";
import { isTenantContext, resolveTenant } from "../tenant.js";

const assignableRole = z.enum(["owner", "admin", "manager", "member", "viewer"]);
const inviteInput = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254), role: assignableRole.exclude(["owner"]) }).strict();
const roleInput = z.object({ role: assignableRole }).strict();
const INVITE_DAYS = 7;

async function ownerCount(organizationId: string) {
  const [row] = await requireDb().select({ total: count() }).from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")));
  return Number(row?.total ?? 0);
}

export const teamRoutes = new Hono();

teamRoutes.get("/", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const members = await database.select({
    id: member.id, userId: member.userId, role: member.role, joinedAt: member.createdAt, name: user.name, email: user.email,
  }).from(member).innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, tenant.organizationId)).orderBy(member.createdAt);
  const invitations = can(tenant.role, "team:manage") ? await database.select({
    id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt, createdAt: invitation.createdAt,
  }).from(invitation).where(and(eq(invitation.organizationId, tenant.organizationId), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date())))
    .orderBy(invitation.createdAt) : [];
  return c.json({
    data: {
      members: members.map((row) => ({ ...row, role: normalizeRole(row.role) })),
      invitations, me: { userId: tenant.userId, role: normalizeRole(tenant.role), permissions: permissionsFor(tenant.role) },
    },
  });
});

teamRoutes.get("/options", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const rows = await requireDb().select({ id: user.id, name: user.name, email: user.email }).from(member)
    .innerJoin(user, eq(user.id, member.userId)).where(eq(member.organizationId, tenant.organizationId)).orderBy(user.name);
  return c.json({ data: rows });
});

teamRoutes.post("/invitations", async (c) => {
  const tenant = await resolveTenant(c, "team:manage");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, inviteInput);
  if (!parsed.ok) return parsed.response;
  if (!canManageRole(tenant.role, parsed.data.role)) return forbidden(c, "Only an owner can invite admins.");
  const database = requireDb();
  const [existingMember] = await database.select({ id: member.id }).from(member).innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, tenant.organizationId), sql`lower(${user.email}) = ${parsed.data.email}`)).limit(1);
  if (existingMember) return c.json({ error: "conflict", message: "That person is already a member of this workspace." }, 409);
  const [pending] = await database.select({ total: count() }).from(invitation)
    .where(and(eq(invitation.organizationId, tenant.organizationId), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date())));
  if (Number(pending?.total ?? 0) >= 25) return c.json({ error: "limit", message: "Cancel some pending invitations before sending more." }, 429);
  await database.update(invitation).set({ status: "canceled" })
    .where(and(eq(invitation.organizationId, tenant.organizationId), eq(invitation.status, "pending"), sql`lower(${invitation.email}) = ${parsed.data.email}`));
  const [created] = await database.insert(invitation).values({
    id: randomUUID(), organizationId: tenant.organizationId, email: parsed.data.email, role: parsed.data.role,
    status: "pending", expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000), inviterId: tenant.userId,
  }).returning({ id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt });
  await recordActivity(tenant, { action: "team.invited", entityType: "invitation", entityId: created.id, summary: "invited " + created.email + " as " + created.role });
  return c.json({ data: created }, 201);
});

teamRoutes.delete("/invitations/:id", async (c) => {
  const tenant = await resolveTenant(c, "team:manage");
  if (!isTenantContext(tenant)) return tenant;
  const [updated] = await requireDb().update(invitation).set({ status: "canceled" })
    .where(and(eq(invitation.id, c.req.param("id")), eq(invitation.organizationId, tenant.organizationId), eq(invitation.status, "pending")))
    .returning({ id: invitation.id, email: invitation.email });
  if (!updated) return notFound(c, "Invitation");
  await recordActivity(tenant, { action: "team.invite_canceled", entityType: "invitation", entityId: updated.id, summary: "canceled the invitation for " + updated.email });
  return c.json({ data: updated });
});

teamRoutes.patch("/members/:id", async (c) => {
  const tenant = await resolveTenant(c, "team:manage");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, roleInput);
  if (!parsed.ok) return parsed.response;
  const database = requireDb();
  const [target] = await database.select({ id: member.id, userId: member.userId, role: member.role, name: user.name }).from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.id, c.req.param("id")), eq(member.organizationId, tenant.organizationId))).limit(1);
  if (!target) return notFound(c, "Member");
  if (!canManageRole(tenant.role, target.role) || !canManageRole(tenant.role, parsed.data.role)) {
    return forbidden(c, "You can't change this member's role. Only owners manage owners and admins.");
  }
  if (normalizeRole(target.role) === "owner" && parsed.data.role !== "owner" && await ownerCount(tenant.organizationId) <= 1) {
    return c.json({ error: "last_owner", message: "A workspace needs at least one owner. Make someone else an owner first." }, 409);
  }
  await database.update(member).set({ role: parsed.data.role }).where(and(eq(member.id, target.id), eq(member.organizationId, tenant.organizationId)));
  await recordActivity(tenant, { action: "team.role_changed", entityType: "member", entityId: target.id, summary: "changed " + target.name + "'s role to " + parsed.data.role });
  return c.json({ data: { id: target.id, role: parsed.data.role } });
});

teamRoutes.delete("/members/:id", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const [target] = await database.select({ id: member.id, userId: member.userId, role: member.role, name: user.name }).from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.id, c.req.param("id")), eq(member.organizationId, tenant.organizationId))).limit(1);
  if (!target) return notFound(c, "Member");
  const leaving = target.userId === tenant.userId;
  if (!leaving && !(can(tenant.role, "team:manage") && canManageRole(tenant.role, target.role))) return forbidden(c, "You can't remove this member.");
  if (normalizeRole(target.role) === "owner" && await ownerCount(tenant.organizationId) <= 1) {
    return c.json({ error: "last_owner", message: "The last owner can't leave. Make someone else an owner first." }, 409);
  }
  await database.delete(member).where(and(eq(member.id, target.id), eq(member.organizationId, tenant.organizationId)));
  await recordActivity(tenant, { action: leaving ? "team.left" : "team.removed", entityType: "member", entityId: target.id, summary: leaving ? "left the workspace" : "removed " + target.name + " from the workspace" });
  return c.json({ data: { id: target.id, left: leaving } });
});

/** Invitation lookups need a signed-in user but not an active workspace. */
export const invitationRoutes = new Hono();

invitationRoutes.get("/:id", async (c) => {
  const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sessionData) return c.json({ error: "unauthorized", message: "Sign in to view this invitation." }, 401);
  const [row] = await requireDb().select({
    id: invitation.id, email: invitation.email, role: invitation.role, status: invitation.status, expiresAt: invitation.expiresAt,
    organizationId: invitation.organizationId, organizationName: organization.name, inviterName: user.name,
  }).from(invitation).innerJoin(organization, eq(organization.id, invitation.organizationId))
    .leftJoin(user, eq(user.id, invitation.inviterId)).where(eq(invitation.id, c.req.param("id"))).limit(1);
  if (!row) return notFound(c, "Invitation");
  const emailMatches = row.email.toLowerCase() === sessionData.user.email.toLowerCase();
  return c.json({ data: {
    id: row.id, role: row.role, status: row.status, expired: row.expiresAt < new Date(), emailMatches,
    organizationName: row.organizationName, inviterName: row.inviterName,
    email: emailMatches ? row.email : row.email.replace(/^(.).*(@.*)$/, "$1•••$2"),
  } });
});

invitationRoutes.post("/:id/accept", async (c) => {
  const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sessionData) return c.json({ error: "unauthorized", message: "Sign in to accept this invitation." }, 401);
  const database = requireDb();
  const [row] = await database.select().from(invitation).where(eq(invitation.id, c.req.param("id"))).limit(1);
  if (!row || row.status !== "pending") return c.json({ error: "not_found", message: "This invitation is no longer available." }, 404);
  if (row.expiresAt < new Date()) return c.json({ error: "expired", message: "This invitation has expired. Ask for a new one." }, 410);
  if (row.email.toLowerCase() !== sessionData.user.email.toLowerCase()) {
    return forbidden(c, "This invitation was sent to a different email address. Sign in with that address to accept it.");
  }
  const [existing] = await database.select({ id: member.id }).from(member)
    .where(and(eq(member.organizationId, row.organizationId), eq(member.userId, sessionData.user.id))).limit(1);
  if (!existing) {
    await database.insert(member).values({ id: randomUUID(), organizationId: row.organizationId, userId: sessionData.user.id, role: normalizeRole(row.role ?? "member") });
  }
  await database.update(invitation).set({ status: "accepted" }).where(eq(invitation.id, row.id));
  await recordActivity({ userId: sessionData.user.id, userName: sessionData.user.name, organizationId: row.organizationId, role: row.role ?? "member" }, {
    action: "team.joined", entityType: "member", entityId: sessionData.user.id, summary: "joined the workspace as " + normalizeRole(row.role),
  });
  return c.json({ data: { organizationId: row.organizationId } });
});
