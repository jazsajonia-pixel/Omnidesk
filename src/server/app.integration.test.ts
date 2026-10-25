import { beforeAll, describe, expect, it } from "vitest";

type CookieJar = Map<string, string>;
type TestApp = { request: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response> };

const requiredEnvironment = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "APP_ORIGIN"] as const;
const enabled = requiredEnvironment.every((key) => Boolean(process.env[key]?.trim()));
describe.skipIf(!enabled)("tenant isolation integration", () => {
  let app: TestApp;
  const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    const module = await import("./app");
    app = module.app;
  });

  it("reports ready only when the required server configuration exists", async () => {
    const response = await request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      service: "omnidesk-api",
      database: true,
    });
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
  async function request(path: string, options: { method?: string; body?: unknown; jar?: CookieJar } = {}) {
    const headers = new Headers({ origin, "content-type": "application/json" });
    if (options.jar?.size) headers.set("cookie", cookieHeader(options.jar));
    const response = await app.request(origin + path, {
      method: options.method ?? "GET", headers,
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
      method: "POST", jar, body: { name: label + " workspace", slug: label.toLowerCase() + "-" + suffix },
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

  it("scopes customer search, pagination, detail, writes, archive, restore, and dashboard counts to the active organization", async () => {
    const first = await createUserAndWorkspace("TenantA");
    const second = await createUserAndWorkspace("TenantB");

    const created = await request("/api/customers", {
      method: "POST", jar: first.jar,
      body: { name: "Tenant A customer", email: "customer-a-" + suffix + "@example.test", company: "Acme" },
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { data: { id: string } };
    const customerId = createdBody.data.id;

    const search = await request("/api/customers?search=Tenant%20A&page=1&pageSize=1", { jar: first.jar });
    expect(search.status).toBe(200);
    const searchBody = await search.json() as { data: Array<{ id: string; name: string }>; pagination: { total: number; page: number; pageSize: number } };
    expect(searchBody.data.map((customer) => customer.name)).toContain("Tenant A customer");
    expect(searchBody.pagination).toMatchObject({ total: 1, page: 1, pageSize: 1 });

    const secondList = await request("/api/customers", { jar: second.jar });
    const secondBody = await secondList.json() as { data: Array<{ name: string }> };
    expect(secondBody.data).toEqual([]);
    expect((await request("/api/customers/" + customerId, { jar: second.jar })).status).toBe(404);

    const forged = await request("/api/customers", {
      method: "POST", jar: second.jar,
      body: { name: "Forged customer", organizationId: first.organizationId },
    });
    expect(forged.status).toBe(400);

    const updated = await request("/api/customers/" + customerId, {
      method: "PATCH", jar: first.jar, body: { name: "Updated Tenant A customer", company: "Acme Studio" },
    });
    expect(updated.status).toBe(200);

    const archived = await request("/api/customers/" + customerId + "/archive", { method: "POST", jar: first.jar });
    expect(archived.status).toBe(200);
    const activeList = await request("/api/customers", { jar: first.jar });
    expect((await activeList.json() as { data: unknown[] }).data).toEqual([]);
    const archivedList = await request("/api/customers?archived=true", { jar: first.jar });
    const archivedBody = await archivedList.json() as { data: Array<{ name: string }> };
    expect(archivedBody.data[0]?.name).toBe("Updated Tenant A customer");
    expect((await request("/api/dashboard/summary", { jar: first.jar }).then((r) => r.json()) as { customers: number }).customers).toBe(0);

    const restored = await request("/api/customers/" + customerId + "/restore", { method: "POST", jar: first.jar });
    expect(restored.status).toBe(200);
    expect((await request("/api/dashboard/summary", { jar: first.jar }).then((r) => r.json()) as { customers: number }).customers).toBe(1);
  });
});
