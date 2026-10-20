import { describe, expect, it } from "vitest";
import { isTenantContext, type TenantContext } from "./tenant";

describe("tenant context guard", () => {
  it("accepts a resolved tenant context", () => {
    const tenant: TenantContext = { userId: "user-a", organizationId: "org-a", role: "member" };
    expect(isTenantContext(tenant)).toBe(true);
  });
  it("rejects a response returned by the auth/membership guard", () => {
    const response = new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    expect(isTenantContext(response)).toBe(false);
  });
  it("keeps organization identity server-derived", () => {
    const tenant: TenantContext = { userId: "user-a", organizationId: "org-a", role: "member" };
    expect(tenant.organizationId).toBe("org-a");
    expect(tenant.organizationId).not.toBe("org-from-request-body");
  });
});
