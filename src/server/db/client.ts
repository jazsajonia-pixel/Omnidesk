import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { schema } from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NODE_ENV !== "test") {
  console.warn("DATABASE_URL is not configured; database-backed API routes will not work.");
}
export const pool = connectionString ? new Pool({ connectionString }) : null;
export const db = pool ? drizzle(pool, { schema }) : null;

export function requireDb() {
  if (!db) throw new Error("Database is not configured. Set DATABASE_URL on the server.");
  return db;
}
