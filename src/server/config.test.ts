import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../../api/index.js";
import { serverEnvironmentIssues } from "./config.js";

const required = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "APP_ORIGIN"] as const;
const validEnvironment = {
  DATABASE_URL: "postgres://example.invalid/omnidesk",
  BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
  BETTER_AUTH_URL: "https://omnidesk.example",
  APP_ORIGIN: "https://omnidesk.example",
} as NodeJS.ProcessEnv;
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
    expect(serverEnvironmentIssues({} as NodeJS.ProcessEnv)).toEqual([...required]);
  });

  it("accepts a complete, valid server configuration", () => {
    expect(serverEnvironmentIssues(validEnvironment)).toEqual([]);
  });

  it("rejects malformed values and reports names only", () => {
    const env = {
      ...validEnvironment,
      DATABASE_URL: "https://database.example.invalid/omnidesk",
      BETTER_AUTH_SECRET: "short-secret",
      BETTER_AUTH_URL: "https://omnidesk.example/nested/path",
      APP_ORIGIN: "not-an-origin",
    } as NodeJS.ProcessEnv;

    expect(serverEnvironmentIssues(env)).toEqual([...required]);
    expect(serverEnvironmentIssues(env).join(" ")).not.toContain("short-secret");
    expect(serverEnvironmentIssues(env).join(" ")).not.toContain("database.example.invalid");
  });

  it("requires HTTPS for every browser/auth origin in production", () => {
    const env = {
      ...validEnvironment,
      NODE_ENV: "production",
      BETTER_AUTH_URL: "http://omnidesk.example",
      APP_ORIGIN: "https://omnidesk.example,http://preview.example",
    } as NodeJS.ProcessEnv;

    expect(serverEnvironmentIssues(env)).toEqual(["BETTER_AUTH_URL", "APP_ORIGIN"]);
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

  it("fails closed when values are present but malformed", async () => {
    process.env.DATABASE_URL = "postgres://example.invalid/omnidesk";
    process.env.BETTER_AUTH_SECRET = "too-short";
    process.env.BETTER_AUTH_URL = "https://omnidesk.example";
    process.env.APP_ORIGIN = "https://omnidesk.example";

    const response = await GET(new Request("https://omnidesk.example/api/health"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "not_ready",
      service: "omnidesk-api",
      database: false,
    });
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
