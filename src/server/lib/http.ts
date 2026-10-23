import type { Context } from "hono";
import type { z } from "zod";

type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

export async function parseBody<S extends z.ZodTypeAny>(c: Context, schema: S): Promise<Parsed<z.infer<S>>> {
  let body: unknown;
  try { body = await c.req.json(); }
  catch { return { ok: false, response: c.json({ error: "invalid_json", message: "Request body must be valid JSON." }, 400) }; }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    return { ok: false, response: c.json({ error: "validation_error", message: issues[0]?.message ?? "Check the form and try again.", issues }, 400) };
  }
  return { ok: true, data: parsed.data };
}

export function notFound(c: Context, label = "Record") {
  return c.json({ error: "not_found", message: label + " not found." }, 404);
}

export function forbidden(c: Context, message = "Your role doesn't allow this action.") {
  return c.json({ error: "forbidden", message }, 403);
}

export function pageParams(c: Context, defaultSize = 20, maxSize = 100) {
  const page = Math.max(1, Math.min(100_000, Number.parseInt(c.req.query("page") ?? "1", 10) || 1));
  const pageSize = Math.max(1, Math.min(maxSize, Number.parseInt(c.req.query("pageSize") ?? String(defaultSize), 10) || defaultSize));
  return { page, pageSize };
}

export function searchParam(c: Context, name = "search") {
  return (c.req.query(name) ?? "").trim().slice(0, 120);
}

/** Escape LIKE wildcards so user input is matched literally. */
export function likePattern(value: string) {
  return "%" + value.replace(/[\\%_]/g, (match) => "\\" + match) + "%";
}

export const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function today() {
  return new Date().toISOString().slice(0, 10);
}
