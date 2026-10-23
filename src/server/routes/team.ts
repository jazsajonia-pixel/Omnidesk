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

type Database = ReturnType<typeof requireDb>;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function ownerCount(tx: Tx, organizationId: string) {
  const [row] = await tx.select({ total: count() }).from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")));
  return Number(row?.total ?? 0);
}

/**
 * Role changes and departures run inside a transaction that first locks the
 * workspace row, so concurrent requests are serialised. Both the actor's and the
 * target's roles are re-read after the lock: a check made before it could be stale
 * (two owners demoting each other, or both leaving at once, would otherwise leave
 * the workspace with no owner).
 */
async function withWorkspaceLock<T>(organizationId: string, userId: string, memberId: string, run: (tx: Tx, ctx: {
  actorRole: string | null; target: { id: string; userId: string; role: string; name: string } | undefined;
}) => Promise<T>) {
  return requireDb().transaction(async (tx) => {
    await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, organizationId)).for("update");
    const [actor] = await tx.select({ role: member.role }).from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId))).limit(1);
    const [target] = await tx.select({ id: member.id, userId: member.userId, role: member.role, name: user.name }).from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId))).limit(1);
    return run(tx, { actorRole: actor?.role ?? null, target });
  });
}

export const teamRoutes = new Hono();

teamRoutes.get("/", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const members = await database.select({
    id: member.id, userId: member.userId, role: member.role, joinedAt: member.createdAt, name: user.name, email: user.email,
  }).from(member).innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, tenant.organizationId)).orderBy(member.createdAt, member.id);
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
  const role = parsed.data.role;
  const result = await withWorkspaceLock(tenant.organizationId, tenant.userId, c.req.param("id"), async (tx, { actorRole, target }) => {
    if (!target) return "not_found" as const;
    if (!actorRole || !can(actorRole, "team:manage") || !canManageRole(actorRole, target.role) || !canManageRole(actorRole, role)) return "forbidden" as const;
    if (normalizeRole(target.role) === "owner" && role !== "owner" && await ownerCount(tx, tenant.organizationId) <= 1) return "last_owner" as const;
    await tx.update(member).set({ role }).where(and(eq(member.id, target.id), eq(member.organizationId, tenant.organizationId)));
    return target;
  });
  if (result === "not_found") return notFound(c, "Member");
  if (result === "forbidden") return forbidden(c, "You can't change this member's role. Only owners manage owners and admins.");
  if (result === "last_owner") return c.json({ error: "last_owner", message: "A workspace needs at least one owner. Make someone else an owner first." }, 409);
  await recordActivity(tenant, { action: "team.role_changed", entityType: "member", entityId: result.id, summary: "changed " + result.name + "'s role to " + role });
  return c.json({ data: { id: result.id, role } });
});

teamRoutes.delete("/members/:id", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const result = await withWorkspaceLock(tenant.organizationId, tenant.userId, c.req.param("id"), async (tx, { actorRole, target }) => {
    if (!target || !actorRole) return "not_found" as const;
    const leaving = target.userId === tenant.userId;
    if (!leaving && !(can(actorRole, "team:manage") && canManageRole(actorRole, target.role))) return "forbidden" as const;
    if (normalizeRole(target.role) === "owner" && await ownerCount(tx, tenant.organizationId) <= 1) return "last_owner" as const;
    await tx.delete(member).where(and(eq(member.id, target.id), eq(member.organizationId, tenant.organizationId)));
    return { ...target, leaving };
  });
  if (result === "not_found") return notFound(c, "Member");
  if (result === "forbidden") return forbidden(c, "You can't remove this member.");
  if (result === "last_owner") return c.json({ error: "last_owner", message: "The last owner can't leave. Make someone else an owner first." }, 409);
  await recordActivity(tenant, { action: result.leaving ? "team.left" : "team.removed", entityType: "member", entityId: result.id, summary: result.leaving ? "left the workspace" : "removed " + result.name + " from the workspace" });
  return c.json({ data: { id: result.id, left: result.leaving } });
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
  // Claim the invitation atomically so opening the link twice at once can't join twice.
  const claimed = await database.transaction(async (tx) => {
    const [claim] = await tx.update(invitation).set({ status: "accepted" })
      .where(and(eq(invitation.id, row.id), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date()),
        sql`lower(${invitation.email}) = ${sessionData.user.email.toLowerCase()}`))
      .returning({ id: invitation.id });
    if (!claim) return false;
    await tx.insert(member).values({ id: randomUUID(), organizationId: row.organizationId, userId: sessionData.user.id, role: normalizeRole(row.role ?? "member") })
      .onConflictDoNothing({ target: [member.organizationId, member.userId] });
    return true;
  });
  if (!claimed) return c.json({ error: "not_found", message: "This invitation is no longer available." }, 404);
  await recordActivity({ userId: sessionData.user.id, userName: sessionData.user.name, organizationId: row.organizationId, role: row.role ?? "member" }, {
    action: "team.joined", entityType: "member", entityId: sessionData.user.id, summary: "joined the workspace as " + normalizeRole(row.role),
  });
  return c.json({ data: { organizationId: row.organizationId } });
});
