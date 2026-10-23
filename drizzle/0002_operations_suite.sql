ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "phone" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limit" (
  "id" text PRIMARY KEY NOT NULL, "key" text NOT NULL, "count" integer NOT NULL, "last_request" bigint NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rate_limit_key_unique" ON "rate_limit" ("key");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_notes" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "customer_id" text NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "author_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "body" text NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_notes_org_customer_idx" ON "customer_notes" ("organization_id", "customer_id", "created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "customer_id" text REFERENCES "customers"("id") ON DELETE SET NULL,
  "name" text NOT NULL, "description" text, "status" text DEFAULT 'planning' NOT NULL, "due_date" date,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL,
  "archived_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_status_idx" ON "projects" ("organization_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_customer_idx" ON "projects" ("organization_id", "customer_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "project_id" text REFERENCES "projects"("id") ON DELETE SET NULL,
  "title" text NOT NULL, "description" text, "status" text DEFAULT 'todo' NOT NULL,
  "priority" text DEFAULT 'medium' NOT NULL, "assignee_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "due_date" date, "position" integer DEFAULT 0 NOT NULL,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_status_idx" ON "tasks" ("organization_id", "status", "position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_project_idx" ON "tasks" ("organization_id", "project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_assignee_idx" ON "tasks" ("organization_id", "assignee_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "project_id" text REFERENCES "projects"("id") ON DELETE SET NULL,
  "title" text NOT NULL, "body" text DEFAULT '' NOT NULL,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_org_updated_idx" ON "documents" ("organization_id", "updated_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "actor_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "action" text NOT NULL, "entity_type" text NOT NULL, "entity_id" text,
  "summary" text NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_org_created_idx" ON "activity" ("organization_id", "created_at");
