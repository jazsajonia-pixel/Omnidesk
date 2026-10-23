import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

describe("security response headers", () => {
  it("adds conservative browser security headers to API responses", async () => {
    const app = new Hono();
    app.use("*", securityHeaders);
    app.get("/health", (c) => c.json({ status: "ok" }));

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
