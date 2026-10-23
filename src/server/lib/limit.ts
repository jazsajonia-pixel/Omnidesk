import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { requireDb } from "../db/client.js";
import { rateLimit } from "../db/schema.js";

/** Fixed-window limiter backed by the shared rate_limit table (safe across serverless instances). */
export async function consumeLimit(key: string, max: number, windowSeconds: number) {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const [row] = await requireDb().insert(rateLimit).values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${rateLimit.lastRequest} < ${windowStart} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${rateLimit.lastRequest} < ${windowStart} then ${now} else ${rateLimit.lastRequest} end`,
      },
    }).returning({ count: rateLimit.count });
  return { allowed: (row?.count ?? 1) <= max };
}

export async function resetLimit(key: string) {
  await requireDb().delete(rateLimit).where(eq(rateLimit.key, key));
}

export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
