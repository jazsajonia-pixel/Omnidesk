import { randomUUID } from "node:crypto";
import { requireDb } from "../db/client.js";
import { activity } from "../db/schema.js";
import type { TenantContext } from "../tenant-context.js";

export type ActivityInput = { action: string; entityType: string; entityId?: string | null; summary: string };

/** Record a workspace audit event. Failures are logged and never block the user's change. */
export async function recordActivity(tenant: TenantContext, input: ActivityInput) {
  try {
    await requireDb().insert(activity).values({
      id: randomUUID(), organizationId: tenant.organizationId, actorId: tenant.userId,
      action: input.action, entityType: input.entityType, entityId: input.entityId ?? null,
      summary: input.summary.slice(0, 300),
    });
  } catch (error) {
    console.error("OmniDesk activity write failed", { action: input.action, error: error instanceof Error ? error.message : "unknown" });
  }
}
