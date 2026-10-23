import { bigint, boolean, date, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const user = pgTable("user", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false), image: text("image"),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex("user_email_unique").on(table.email)]);

export const session = pgTable("session", {
  id: text("id").primaryKey(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
  ipAddress: text("ip_address"), userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
}, (table) => [uniqueIndex("session_token_unique").on(table.token), index("session_user_id_idx").on(table.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"), password: text("password"), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index("account_user_id_idx").on(table.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const organization = pgTable("organization", {
  id: text("id").primaryKey(), name: text("name").notNull(), slug: text("slug").notNull(),
  logo: text("logo"), createdAt: createdAt(), metadata: text("metadata"),
}, (table) => [uniqueIndex("organization_slug_unique").on(table.slug)]);

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), createdAt: createdAt(),
}, (table) => [index("member_user_id_idx").on(table.userId), uniqueIndex("member_org_user_unique").on(table.organizationId, table.userId)]);

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(), role: text("role"), status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: createdAt(),
  inviterId: text("inviter_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("invitation_org_id_idx").on(table.organizationId)]);

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(), email: text("email"), company: text("company"),
  phone: text("phone"), status: text("status").notNull().default("active"),
  createdAt: createdAt(), updatedAt: updatedAt(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
}, (table) => [
  index("customers_org_created_idx").on(table.organizationId, table.createdAt),
  index("customers_org_name_idx").on(table.organizationId, table.name),
  index("customers_org_archived_created_idx").on(table.organizationId, table.archivedAt, table.createdAt),
]);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(), key: text("key").notNull(), count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
}, (table) => [uniqueIndex("rate_limit_key_unique").on(table.key)]);

export const customerNotes = pgTable("customer_notes", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
  body: text("body").notNull(), createdAt: createdAt(),
}, (table) => [index("customer_notes_org_customer_idx").on(table.organizationId, table.customerId, table.createdAt)]);

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  name: text("name").notNull(), description: text("description"),
  status: text("status").notNull().default("planning"), dueDate: date("due_date", { mode: "string" }),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(), updatedAt: updatedAt(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
}, (table) => [
  index("projects_org_status_idx").on(table.organizationId, table.status),
  index("projects_org_customer_idx").on(table.organizationId, table.customerId),
]);

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(), description: text("description"),
  status: text("status").notNull().default("todo"), priority: text("priority").notNull().default("medium"),
  assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
  dueDate: date("due_date", { mode: "string" }), position: integer("position").notNull().default(0),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(), updatedAt: updatedAt(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("tasks_org_status_idx").on(table.organizationId, table.status, table.position),
  index("tasks_org_project_idx").on(table.organizationId, table.projectId),
  index("tasks_org_assignee_idx").on(table.organizationId, table.assigneeId),
]);

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(), body: text("body").notNull().default(""),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index("documents_org_updated_idx").on(table.organizationId, table.updatedAt)]);

export const activity = pgTable("activity", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id"),
  summary: text("summary").notNull(), createdAt: createdAt(),
}, (table) => [index("activity_org_created_idx").on(table.organizationId, table.createdAt)]);

export const schema = {
  user, session, account, verification, organization, member, invitation, customers, rateLimit,
  customerNotes, projects, tasks, documents, activity,
};
