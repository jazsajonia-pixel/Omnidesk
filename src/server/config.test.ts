import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../../api/index.js";
import { missingRequiredServerEnvironment } from "./config.js";

const required = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "APP_ORIGIN"] as const;
const environmentKeys = ["NODE_ENV", ...required] as const;
const originalEnvironment = new Map<string, string | undefined>();

beforeEach(() => {
  originalEnvironment.clear();
  for (const key of environmentKeys) originalEnvironment.set(key, process.env[key]);
});

afterEach(() => {
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("required server environment", () => {
  it("lists missing variable names without exposing values", () => {
    expect(missingRequiredServerEnvironment({} as NodeJS.ProcessEnv)).toEqual([...required]);
  });

  it("accepts a complete server configuration", () => {
    const env = {
      DATABASE_URL: "postgres://example.invalid/omnidesk",
      BETTER_AUTH_SECRET: "test-only-secret",
      BETTER_AUTH_URL: "https://omnidesk.example",
      APP_ORIGIN: "https://omnidesk.example",
    } as NodeJS.ProcessEnv;
    expect(missingRequiredServerEnvironment(env)).toEqual([]);
  });
});

describe("production API configuration guard", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "production";
    for (const key of required) delete process.env[key];
  });

  it("returns a 503 readiness response when required configuration is missing", async () => {
    const response = await GET(new Request("https://omnidesk.example/api/health"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "not_ready",
      service: "omnidesk-api",
      database: false,
    });
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("blocks other API routes with a generic response before auth or database initialization", async () => {
    const response = await GET(new Request("https://omnidesk.example/api/me"));
    expect(response.status).toBe(503);
    const body = await response.json() as { error: string; message: string };
    expect(body).toEqual({
      error: "service_unavailable",
      message: "Server configuration is incomplete.",
    });
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(body)).not.toContain("BETTER_AUTH_SECRET");
  });
});
