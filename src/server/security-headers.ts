import type { MiddlewareHandler } from "hono";

/**
 * Conservative browser-facing response headers for the API and auth endpoints.
 * Content-Security-Policy and HSTS are intentionally not set here: the SPA is
 * served separately, and HTTPS enforcement belongs to the hosting layer.
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Cache-Control", "no-store");
};
