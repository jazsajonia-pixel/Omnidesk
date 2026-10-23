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

  it("places board moves by neighbour anchors even when stored positions have gaps", async () => {
    const a = await owner("AnchorOwner");
    const b = await owner("AnchorOther");
    const ids: Record<string, string> = {};
    for (const title of ["A", "B", "C", "D"]) {
      ids[title] = (await json<{ data: { id: string } }>(request("/api/tasks", { method: "POST", jar: a.jar, body: { title } }))).data.id;
    }
    const foreign = (await json<{ data: { id: string } }>(request("/api/tasks", { method: "POST", jar: b.jar, body: { title: "Foreign" } }))).data.id;
    expect((await request("/api/tasks/" + ids.B, { method: "DELETE", jar: a.jar })).status).toBeLessThan(300);
    const todo = async () => (await json<{ data: { id: string; position: number }[] }>(request("/api/tasks?status=todo", { jar: a.jar }))).data;
    // Column is now A(0), C(2), D(3): the stored position of C no longer equals its index.
    expect((await todo()).map((t) => t.position)).toEqual([0, 2, 3]);
    const move = (id: string, body: unknown) => request("/api/tasks/" + id + "/move", { method: "POST", jar: a.jar, body });
    expect((await move(ids.D, { status: "todo", beforeId: ids.C })).status).toBe(200);
    expect((await todo()).map((t) => t.id)).toEqual([ids.A, ids.D, ids.C]);
    expect((await move(ids.A, { status: "todo", afterId: ids.C })).status).toBe(200);
    expect((await todo()).map((t) => t.id)).toEqual([ids.D, ids.C, ids.A]);
    // Anchors from another workspace are ignored; the task falls back to the end.
    expect((await move(ids.D, { status: "todo", beforeId: foreign })).status).toBe(200);
    expect((await todo()).map((t) => t.id)).toEqual([ids.C, ids.A, ids.D]);
    // The original numeric API still works.
    expect((await move(ids.D, { status: "todo", position: 0 })).status).toBe(200);
    expect((await todo()).map((t) => t.id)).toEqual([ids.D, ids.C, ids.A]);
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

  async function twoOwnerWorkspace(label: string) {
    const a = await owner(label);
    const b = await signUp(label + "Second");
    const invitationId = (await json<{ data: { id: string } }>(request("/api/team/invitations", { method: "POST", jar: a.jar, body: { email: b.email, role: "member" } }))).data.id;
    expect((await request("/api/invitations/" + invitationId + "/accept", { method: "POST", jar: b.jar })).status).toBe(200);
    expect((await request("/api/auth/organization/set-active", { method: "POST", jar: b.jar, body: { organizationId: a.organizationId } })).status).toBeLessThan(300);
    const members = (await json<{ data: { members: { id: string; email: string }[] } }>(request("/api/team", { jar: a.jar }))).data.members;
    const aId = members.find((m) => m.email !== b.email)!.id;
    const bId = members.find((m) => m.email === b.email)!.id;
    expect((await request("/api/team/members/" + bId, { method: "PATCH", jar: a.jar, body: { role: "owner" } })).status).toBe(200);
    return { a, b, aId, bId };
  }
  const ownersLeft = async (jar: CookieJar) => (await json<{ data: { members: { role: string }[] } }>(request("/api/team", { jar }))).data.members.filter((m) => m.role === "owner").length;

  it("never lets simultaneous demotions or departures remove the last owner", async () => {
    for (let round = 0; round < 4; round++) {
      // Both owners demote each other at the same moment.
      const w = await twoOwnerWorkspace("RaceDemote" + round);
      const results = await Promise.all([
        request("/api/team/members/" + w.bId, { method: "PATCH", jar: w.a.jar, body: { role: "admin" } }),
        request("/api/team/members/" + w.aId, { method: "PATCH", jar: w.b.jar, body: { role: "admin" } }),
      ]);
      // The loser is refused either as "last owner" (409) or because it's no longer an owner (403).
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.every((r) => [200, 403, 409].includes(r.status))).toBe(true);
      expect(await ownersLeft(results[0].status === 200 ? w.a.jar : w.b.jar)).toBe(1);

      // Both owners leave at the same moment.
      const v = await twoOwnerWorkspace("RaceLeave" + round);
      const left = await Promise.all([
        request("/api/team/members/" + v.aId, { method: "DELETE", jar: v.a.jar }),
        request("/api/team/members/" + v.bId, { method: "DELETE", jar: v.b.jar }),
      ]);
      expect(left.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await ownersLeft(left[0].status === 200 ? v.b.jar : v.a.jar)).toBe(1);
    }
  });

  it("accepts an invitation exactly once even when the link is opened twice at once", async () => {
    const a = await owner("RaceInvite");
    const guest = await signUp("RaceGuest");
    const invitationId = (await json<{ data: { id: string } }>(request("/api/team/invitations", { method: "POST", jar: a.jar, body: { email: guest.email, role: "member" } }))).data.id;
    const results = await Promise.all([1, 2, 3].map(() => request("/api/invitations/" + invitationId + "/accept", { method: "POST", jar: guest.jar })));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 404, 404]);
    const team = await json<{ data: { members: { email: string }[] } }>(request("/api/team", { jar: a.jar }));
    expect(team.data.members.filter((m) => m.email === guest.email)).toHaveLength(1);
    const activity = await json<{ data: { action: string }[] }>(request("/api/workspace/activity", { jar: a.jar }));
    expect(activity.data.filter((x) => x.action === "team.joined")).toHaveLength(1);
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
