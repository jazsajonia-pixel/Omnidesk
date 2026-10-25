import { Hono } from "hono";
import { serverEnvironmentIssues } from "../src/server/config.js";
import { securityHeaders } from "../src/server/security-headers.js";

// Keep a small, safe response available before importing auth/database modules.
// A misconfigured production function must not fall back to memory-backed auth.
const unavailableApp = new Hono();
unavailableApp.use("*", securityHeaders);
unavailableApp.get("/api/health", (c) => c.json({
  status: "not_ready",
  service: "omnidesk-api",
  database: false,
}, 503));
unavailableApp.all("*", (c) => c.json({
  error: "service_unavailable",
  message: "Server configuration is incomplete.",
}, 503));

/**
 * Vercel Node.js function. All /api/* paths are rewritten here (see vercel.json)
 * and handled by the Hono app using Web-standard Request/Response objects.
 */
const handler = async (request: Request): Promise<Response> => {
  if (process.env.NODE_ENV === "production" && serverEnvironmentIssues().length > 0) {
    return unavailableApp.fetch(request);
  }
  const { app } = await import("../src/server/app.js");
  return app.fetch(request);
};

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const OPTIONS = handler;
