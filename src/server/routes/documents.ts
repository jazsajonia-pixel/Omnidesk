import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";
import { requireDb } from "../db/client.js";
import { documents, projects, user } from "../db/schema.js";
import { recordActivity } from "../lib/activity.js";
import { forbidden, likePattern, notFound, parseBody, searchParam } from "../lib/http.js";
import { can } from "../permissions.js";
import { isTenantContext, resolveTenant } from "../tenant.js";

const documentInput = z.object({
  title: z.string().trim().min(1, "Give the document a title.").max(200),
  body: z.string().max(50_000, "Documents can be up to 50,000 characters.").optional(),
  projectId: z.string().trim().max(64).nullable().optional(),
}).strict();
const documentUpdateInput = documentInput.partial().strict();
const editor = alias(user, "editor");

export const documentRoutes = new Hono();

documentRoutes.get("/", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const search = searchParam(c);
  const conditions = [eq(documents.organizationId, tenant.organizationId)];
  if (search) conditions.push(or(ilike(documents.title, likePattern(search)), ilike(documents.body, likePattern(search)))!);
  const projectId = c.req.query("projectId");
  if (projectId) conditions.push(eq(documents.projectId, projectId));
  const rows = await requireDb().select({
    id: documents.id, title: documents.title, excerpt: documents.body, projectId: documents.projectId, projectName: projects.name,
    updatedAt: documents.updatedAt, updatedByName: editor.name,
  }).from(documents)
    .leftJoin(projects, and(eq(projects.id, documents.projectId), eq(projects.organizationId, tenant.organizationId)))
    .leftJoin(editor, eq(editor.id, documents.updatedBy))
    .where(and(...conditions)).orderBy(desc(documents.updatedAt)).limit(200);
  return c.json({ data: rows.map((row) => ({ ...row, excerpt: row.excerpt.replace(/[#*_>`-]/g, "").replace(/\s+/g, " ").trim().slice(0, 180) })) });
});

documentRoutes.get("/:id", async (c) => {
  const tenant = await resolveTenant(c);
  if (!isTenantContext(tenant)) return tenant;
  const [row] = await requireDb().select({
    id: documents.id, title: documents.title, body: documents.body, projectId: documents.projectId, projectName: projects.name,
    createdBy: documents.createdBy, createdAt: documents.createdAt, updatedAt: documents.updatedAt, updatedByName: editor.name,
  }).from(documents)
    .leftJoin(projects, and(eq(projects.id, documents.projectId), eq(projects.organizationId, tenant.organizationId)))
    .leftJoin(editor, eq(editor.id, documents.updatedBy))
    .where(and(eq(documents.id, c.req.param("id")), eq(documents.organizationId, tenant.organizationId))).limit(1);
  if (!row) return notFound(c, "Document");
  return c.json({ data: row });
});

async function projectBelongs(organizationId: string, projectId: string | null | undefined) {
  if (!projectId) return true;
  const [row] = await requireDb().select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId))).limit(1);
  return Boolean(row);
}

documentRoutes.post("/", async (c) => {
  const tenant = await resolveTenant(c, "document:write");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, documentInput);
  if (parsed.ok === false) return parsed.response;
  if (!await projectBelongs(tenant.organizationId, parsed.data.projectId)) return c.json({ error: "validation_error", message: "Choose a project from this workspace." }, 400);
  const [created] = await requireDb().insert(documents).values({
    id: randomUUID(), organizationId: tenant.organizationId, title: parsed.data.title, body: parsed.data.body ?? "",
    projectId: parsed.data.projectId || null, createdBy: tenant.userId, updatedBy: tenant.userId,
  }).returning({ id: documents.id, title: documents.title });
  await recordActivity(tenant, { action: "document.created", entityType: "document", entityId: created.id, summary: "created document " + created.title });
  return c.json({ data: created }, 201);
});

documentRoutes.patch("/:id", async (c) => {
  const tenant = await resolveTenant(c, "document:write");
  if (!isTenantContext(tenant)) return tenant;
  const parsed = await parseBody(c, documentUpdateInput);
  if (parsed.ok === false) return parsed.response;
  if (!await projectBelongs(tenant.organizationId, parsed.data.projectId)) return c.json({ error: "validation_error", message: "Choose a project from this workspace." }, 400);
  const values: Partial<typeof documents.$inferInsert> = { updatedAt: new Date(), updatedBy: tenant.userId };
  if (parsed.data.title !== undefined) values.title = parsed.data.title;
  if (parsed.data.body !== undefined) values.body = parsed.data.body;
  if (parsed.data.projectId !== undefined) values.projectId = parsed.data.projectId || null;
  const [updated] = await requireDb().update(documents).set(values)
    .where(and(eq(documents.id, c.req.param("id")), eq(documents.organizationId, tenant.organizationId)))
    .returning({ id: documents.id, title: documents.title, updatedAt: documents.updatedAt });
  if (!updated) return notFound(c, "Document");
  await recordActivity(tenant, { action: "document.updated", entityType: "document", entityId: updated.id, summary: "edited document " + updated.title });
  return c.json({ data: updated });
});

documentRoutes.delete("/:id", async (c) => {
  const tenant = await resolveTenant(c, "document:write");
  if (!isTenantContext(tenant)) return tenant;
  const database = requireDb();
  const [existing] = await database.select({ id: documents.id, title: documents.title, createdBy: documents.createdBy }).from(documents)
    .where(and(eq(documents.id, c.req.param("id")), eq(documents.organizationId, tenant.organizationId))).limit(1);
  if (!existing) return notFound(c, "Document");
  if (existing.createdBy !== tenant.userId && !can(tenant.role, "project:write")) return forbidden(c, "Only the author or a manager can delete this document.");
  await database.delete(documents).where(and(eq(documents.id, existing.id), eq(documents.organizationId, tenant.organizationId)));
  await recordActivity(tenant, { action: "document.deleted", entityType: "document", entityId: existing.id, summary: "deleted document " + existing.title });
  return c.json({ data: { id: existing.id } });
});
