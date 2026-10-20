CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL, "name" text NOT NULL, "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL, "image" text,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL, "expires_at" timestamptz NOT NULL, "token" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL,
  "ip_address" text, "user_agent" text, "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "active_organization_id" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "session_token_unique" ON "session" ("token");
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" ("user_id");
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL, "account_id" text NOT NULL, "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE, "access_token" text,
  "refresh_token" text, "id_token" text, "access_token_expires_at" timestamptz,
  "refresh_token_expires_at" timestamptz, "scope" text, "password" text,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" ("user_id");
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL, "identifier" text NOT NULL, "value" text NOT NULL,
  "expires_at" timestamptz NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");
CREATE TABLE IF NOT EXISTS "organization" (
  "id" text PRIMARY KEY NOT NULL, "name" text NOT NULL, "slug" text NOT NULL,
  "logo" text, "created_at" timestamptz DEFAULT now() NOT NULL, "metadata" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "organization_slug_unique" ON "organization" ("slug");
CREATE TABLE IF NOT EXISTS "member" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" text DEFAULT 'member' NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "member_user_id_idx" ON "member" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "member_org_user_unique" ON "member" ("organization_id", "user_id");
CREATE TABLE IF NOT EXISTS "invitation" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "email" text NOT NULL, "role" text, "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "inviter_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "invitation_org_id_idx" ON "invitation" ("organization_id");
CREATE TABLE IF NOT EXISTS "customers" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL, "email" text, "company" text,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "customers_org_created_idx" ON "customers" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "customers_org_name_idx" ON "customers" ("organization_id", "name");
