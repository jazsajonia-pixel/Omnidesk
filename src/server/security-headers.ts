import type { MiddlewareHandler } from "hono";

/**
 * Conservative browser-facing response headers for the API and auth endpoints.
 * The SPA's own headers (including a Content-Security-Policy) are set in
 * vercel.json; HTTPS enforcement belongs to the hosting layer.
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  if (new URL(c.req.url).protocol === "https:") {
    c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  if (!c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
};
