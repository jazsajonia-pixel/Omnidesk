export const ROLES = ["owner", "admin", "manager", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { viewer: 0, member: 1, manager: 2, admin: 3, owner: 4 };

export type Action =
  | "read"
  | "task:write"
  | "note:write"
  | "document:write"
  | "customer:write"
  | "project:write"
  | "data:export"
  | "team:manage"
  | "workspace:manage";

const MIN_ROLE: Record<Action, Role> = {
  read: "viewer",
  "task:write": "member",
  "note:write": "member",
  "document:write": "member",
  "customer:write": "manager",
  "project:write": "manager",
  "data:export": "manager",
  "team:manage": "admin",
  "workspace:manage": "admin",
};

export function normalizeRole(value: string | null | undefined): Role {
  const first = (value ?? "").split(",")[0]?.trim();
  return (ROLES as readonly string[]).includes(first) ? (first as Role) : "viewer";
}

export function roleRank(role: string) {
  return RANK[normalizeRole(role)];
}

export function can(role: string, action: Action) {
  return roleRank(role) >= RANK[MIN_ROLE[action]];
}

/** Which roles an actor may assign to (or remove from) another member. */
export function canManageRole(actorRole: string, targetRole: string) {
  const actor = normalizeRole(actorRole);
  if (actor === "owner") return true;
  if (actor === "admin") return normalizeRole(targetRole) !== "owner" && normalizeRole(targetRole) !== "admin";
  return false;
}

export function permissionsFor(role: string) {
  return Object.fromEntries((Object.keys(MIN_ROLE) as Action[]).map((action) => [action, can(role, action)])) as Record<Action, boolean>;
}
