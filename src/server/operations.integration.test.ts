import { beforeAll, describe, expect, it } from "vitest";

type CookieJar = Map<string, string>;
type TestApp = { request: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response> };

const enabled = Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
describe.skipIf(!enabled)("operations suite integration", () => {
  let app: TestApp;
  const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  beforeAll(async () => { app = (await import("./app")).app; });

  function updateCookies(jar: CookieJar, response: Response) {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    for (const cookie of headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""]) {
      const pair = cookie.split(";")[0];
      const separator = pair.indexOf("=");
      if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }
  async function request(path: string, options: { method?: string; body?: unknown; jar?: CookieJar; origin?: string } = {}) {
    const headers = new Headers({ origin: options.origin ?? origin, "content-type": "application/json" });
    if (options.jar?.size) headers.set("cookie", [...options.jar.entries()].map(([k, v]) => k + "=" + v).join("; "));
    const response = await app.request(origin + path, { method: options.method ?? "GET", headers, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
    if (options.jar) updateCookies(options.jar, response);
    return response;
  }
  async function json<T>(response: Response | Promise<Response>) { return (await (await response).json()) as T; }
  async function signUp(label: string) {
    const jar: CookieJar = new Map();
    const email = label.toLowerCase() + "-" + suffix + "@example.test";
    const res = await request("/api/auth/sign-up/email", { method: "POST", jar, body: { name: label, email, password: "Test-password-2026!" } });
    expect(res.status).toBeLessThan(300);
    return { jar, email };
  }
  async function owner(label: string) {
    const user = await signUp(label);
    const created = await json<{ id: string }>(request("/api/auth/organization/create", { method: "POST", jar: user.jar, body: { name: label + " workspace", slug: label.toLowerCase() + "-" + suffix } }));
    expect((await request("/api/auth/organization/set-active", { method: "POST", jar: user.jar, body: { organizationId: created.id } })).status).toBeLessThan(300);
    return { ...user, organizationId: created.id };
  }

  it("rejects mutating requests from untrusted origins", async () => {
    const a = await owner("OriginCheck");
    const res = await request("/api/customers", { method: "POST", jar: a.jar, origin: "https://evil.example", body: { name: "Nope" } });
    expect(res.status).toBe(403);
  });

  it("runs projects, tasks, board moves, documents, reports and CSV export inside one workspace", async () => {
    const a = await owner("OpsOwner");
    const b = await owner("OpsOther");
    const customer = await json<{ data: { id: string } }>(request("/api/customers", { method: "POST", jar: a.jar, body: { name: "=HYPERLINK(\"x\")", company: "Formula, Inc", status: "lead" } }));
    const project = await request("/api/projects", { method: "POST", jar: a.jar, body: { name: "Launch", customerId: customer.data.id, status: "active", dueDate: "2030-01-15" } });
    expect(project.status).toBe(201);
    const projectId = (await json<{ data: { id: string } }>(project)).data.id;
    expect((await request("/api/projects", { method: "POST", jar: b.jar, body: { name: "Cross", customerId: customer.data.id } })).status).toBe(400);

    const ids: string[] = [];
    for (const title of ["One", "Two", "Three"]) {
      const res = await request("/api/tasks", { method: "POST", jar: a.jar, body: { title, projectId, priority: "high" } });
      expect(res.status).toBe(201);
      ids.push((await json<{ data: { id: string } }>(res)).data.id);
    }
    expect((await request("/api/tasks/" + ids[0], { jar: b.jar })).status).toBe(404);
    expect((await request("/api/tasks/" + ids[2] + "/move", { method: "POST", jar: a.jar, body: { status: "todo", position: 0 } })).status).toBe(200);
    const todo = await json<{ data: { id: string }[] }>(request("/api/tasks?status=todo", { jar: a.jar }));
    expect(todo.data.map((t) => t.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect((await request("/api/tasks/" + ids[0] + "/move", { method: "POST", jar: a.jar, body: { status: "done", position: 0 } })).status).toBe(200);
    const detail = await json<{ data: { progress: { total: number; done: number } } }>(request("/api/projects/" + projectId, { jar: a.jar }));
    expect(detail.data.progress).toEqual({ total: 3, done: 1 });
    const reports = await json<{ data: { projects: { id: string; total: number; done: number }[] } }>(request("/api/reports", { jar: a.jar }));
    expect(reports.data.projects.find((p) => p.id === projectId)).toMatchObject({ total: 3, done: 1 });

    const doc = await json<{ data: { id: string } }>(request("/api/documents", { method: "POST", jar: a.jar, body: { title: "Brief", body: "# Goals", projectId } }));
    expect((await request("/api/documents/" + doc.data.id, { jar: b.jar })).status).toBe(404);
    expect((await request("/api/documents/" + doc.data.id, { method: "PATCH", jar: a.jar, body: { body: "# Updated" } })).status).toBe(200);

    const csv = await request("/api/export/customers.csv", { jar: a.jar });
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    const text = await csv.text();
    expect(text).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(text).toContain("\"Formula, Inc\"");

    const activity = await json<{ data: { summary: string }[] }>(request("/api/workspace/activity", { jar: a.jar }));
    expect(activity.data.length).toBeGreaterThan(3);
    const otherActivity = await json<{ data: unknown[] }>(request("/api/workspace/activity", { jar: b.jar }));
    expect(otherActivity.data).toEqual([]);
  });

  it("invites a viewer, denies writes for that role, and protects the last owner", async () => {
    const a = await owner("TeamOwner");
    const guest = await signUp("TeamViewer");
    const invite = await request("/api/team/invitations", { method: "POST", jar: a.jar, body: { email: guest.email, role: "viewer" } });
    expect(invite.status).toBe(201);
    const invitationId = (await json<{ data: { id: string } }>(invite)).data.id;

    const info = await json<{ data: { emailMatches: boolean; organizationName: string } }>(request("/api/invitations/" + invitationId, { jar: guest.jar }));
    expect(info.data).toMatchObject({ emailMatches: true, organizationName: "TeamOwner workspace" });
    const accepted = await request("/api/invitations/" + invitationId + "/accept", { method: "POST", jar: guest.jar });
    expect(accepted.status).toBe(200);
    expect((await request("/api/auth/organization/set-active", { method: "POST", jar: guest.jar, body: { organizationId: a.organizationId } })).status).toBeLessThan(300);

    const workspace = await json<{ data: { role: string; permissions: Record<string, boolean> } }>(request("/api/workspace", { jar: guest.jar }));
    expect(workspace.data.role).toBe("viewer");
    expect(workspace.data.permissions["task:write"]).toBe(false);
    expect((await request("/api/customers", { jar: guest.jar })).status).toBe(200);
    expect((await request("/api/tasks", { method: "POST", jar: guest.jar, body: { title: "Not allowed" } })).status).toBe(403);
    expect((await request("/api/export/tasks.csv", { jar: guest.jar })).status).toBe(403);
    expect((await request("/api/team/invitations", { method: "POST", jar: guest.jar, body: { email: "x-" + suffix + "@example.test", role: "member" } })).status).toBe(403);
    expect((await request("/api/invitations/" + invitationId + "/accept", { method: "POST", jar: guest.jar })).status).toBeGreaterThanOrEqual(400);

    const team = await json<{ data: { members: { id: string; role: string; email: string }[] } }>(request("/api/team", { jar: a.jar }));
    const me = team.data.members.find((m) => m.role === "owner")!;
    expect((await request("/api/team/members/" + me.id, { method: "PATCH", jar: a.jar, body: { role: "admin" } })).status).toBe(409);
    expect((await request("/api/team/members/" + me.id, { method: "DELETE", jar: a.jar })).status).toBe(409);
    const viewer = team.data.members.find((m) => m.email === guest.email)!;
    expect((await request("/api/team/members/" + viewer.id, { method: "PATCH", jar: a.jar, body: { role: "member" } })).status).toBe(200);
    expect((await request("/api/tasks", { method: "POST", jar: guest.jar, body: { title: "Now allowed" } })).status).toBe(201);
  });

  it("creates a seeded demo workspace with a session", async () => {
    const jar: CookieJar = new Map();
    const res = await request("/api/demo", { method: "POST", jar });
    expect(res.status).toBe(201);
    expect(jar.size).toBeGreaterThan(0);
    const workspace = await json<{ data: { isDemo: boolean; role: string } }>(request("/api/workspace", { jar }));
    expect(workspace.data).toMatchObject({ isDemo: true, role: "owner" });
    const dashboard = await json<{ data: { customers: number; tasks: { open: number } } }>(request("/api/workspace/dashboard", { jar }));
    expect(dashboard.data.customers).toBeGreaterThan(0);
    expect(dashboard.data.tasks.open).toBeGreaterThan(0);
  });
});
