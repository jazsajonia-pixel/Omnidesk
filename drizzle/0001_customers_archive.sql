ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "archived_at" timestamptz;
CREATE INDEX IF NOT EXISTS "customers_org_archived_created_idx" ON "customers" ("organization_id", "archived_at", "created_at");
