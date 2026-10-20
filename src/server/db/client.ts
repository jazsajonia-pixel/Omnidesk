import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NODE_ENV !== "test") {
  console.warn("DATABASE_URL is not configured; database-backed API routes will not work.");
}

// Use a pooled Neon connection string in hosted environments. A small pool also
// lets CI and local development use a regular PostgreSQL service.
export const pool = connectionString ? new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
}) : null;
export const db = pool ? drizzle(pool, { schema }) : null;

export function requireDb() {
  if (!db) throw new Error("Database is not configured. Set DATABASE_URL on the server.");
  return db;
}
