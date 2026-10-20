import { afterAll, beforeAll, describe, expect, it } from "vitest";

type CookieJar = Map<string, string>;
type TestApp = { request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> };

const enabled = Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
describe.skipIf(!enabled)("tenant isolation integration", () => {
  let app: TestApp;
  const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    const module = await import("./app");
    app = module.app;
  });

  function updateCookies(jar: CookieJar, response: Response) {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
    for (const cookie of setCookies) {
      const pair = cookie.split(";")[0];
      const separator = pair.indexOf("=");
      if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  function cookieHeader(jar: CookieJar) {
    return [...jar.entries()].map(([key, value]) => key + "=" + value).join("; ");
  }

  async function request(path: string, options: {
    method?: string; body?: unknown; jar?: CookieJar;
  } = {}) {
    const headers = new Headers({ origin, "content-type": "application/json" });
    if (options.jar?.size) headers.set("cookie", cookieHeader(options.jar));
    const response = await app.request(origin + path, {
      method: options.method ?? "GET",
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    if (options.jar) updateCookies(options.jar, response);
    return response;
  }

  async function createUserAndWorkspace(label: string) {
    const jar: CookieJar = new Map();
    const signUp = await request("/api/auth/sign-up/email", {
      method: "POST", jar,
      body: { name: label, email: label.toLowerCase() + "-" + suffix + "@example.test", password: "Test-password-2026!" },
    });
    expect(signUp.status, "sign-up should create an authenticated session").toBeLessThan(300);
    expect(jar.size).toBeGreaterThan(0);

    const created = await request("/api/auth/organization/create", {
      method: "POST", jar,
      body: { name: label + " workspace", slug: label.toLowerCase() + "-" + suffix },
    });
    expect(created.status, "workspace creation should succeed").toBeLessThan(300);
    const organization = await created.json() as { id?: string };
    expect(organization.id).toBeTruthy();

    const active = await request("/api/auth/organization/set-active", {
      method: "POST", jar, body: { organizationId: organization.id },
    });
    expect(active.status, "workspace should become active").toBeLessThan(300);
    return { jar, organizationId: organization.id as string };
  }

  it("keeps customer reads and writes inside the authenticated active organization", async () => {
    const first = await createUserAndWorkspace("TenantA");
    const second = await createUserAndWorkspace("TenantB");

    const created = await request("/api/customers", {
      method: "POST", jar: first.jar,
      body: { name: "Tenant A customer", email: "customer-a-" + suffix + "@example.test" },
    });
    expect(created.status).toBe(201);

    const firstList = await request("/api/customers", { jar: first.jar });
    expect(firstList.status).toBe(200);
    const firstBody = await firstList.json() as { data: Array<{ name: string }> };
    expect(firstBody.data.map((customer) => customer.name)).toContain("Tenant A customer");

    const secondList = await request("/api/customers", { jar: second.jar });
    expect(secondList.status).toBe(200);
    const secondBody = await secondList.json() as { data: Array<{ name: string }> };
    expect(secondBody.data).toEqual([]);

    const forged = await request("/api/customers", {
      method: "POST", jar: second.jar,
      body: { name: "Forged customer", organizationId: first.organizationId },
    });
    expect(forged.status).toBe(400);
    const secondAfterAttempt = await request("/api/customers", { jar: second.jar });
    const afterBody = await secondAfterAttempt.json() as { data: Array<{ name: string }> };
    expect(afterBody.data).toEqual([]);
  });
});

afterAll(() => undefined);
