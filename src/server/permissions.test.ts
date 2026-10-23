import { describe, expect, it } from "vitest";
import { can, canManageRole, normalizeRole, permissionsFor } from "./permissions";

describe("role permissions", () => {
  it("orders roles from viewer to owner", () => {
    expect(can("viewer", "read")).toBe(true);
    expect(can("viewer", "task:write")).toBe(false);
    expect(can("member", "task:write")).toBe(true);
    expect(can("member", "customer:write")).toBe(false);
    expect(can("manager", "data:export")).toBe(true);
    expect(can("manager", "team:manage")).toBe(false);
    expect(can("admin", "workspace:manage")).toBe(true);
  });
  it("lets admins manage only roles below admin", () => {
    expect(canManageRole("owner", "owner")).toBe(true);
    expect(canManageRole("admin", "manager")).toBe(true);
    expect(canManageRole("admin", "admin")).toBe(false);
    expect(canManageRole("admin", "owner")).toBe(false);
    expect(canManageRole("manager", "viewer")).toBe(false);
  });
  it("treats unknown roles as viewer", () => {
    expect(normalizeRole("superuser")).toBe("viewer");
    expect(normalizeRole("admin,member")).toBe("admin");
    expect(permissionsFor("nonsense")["task:write"]).toBe(false);
  });
});
