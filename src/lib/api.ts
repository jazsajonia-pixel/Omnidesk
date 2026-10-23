export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "include" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Can't reach OmniDesk. Check your connection and try again.", 0, "network");
  }
  let payload: unknown = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const body = payload && typeof payload === "object" ? payload as { message?: string; error?: string } : {};
    throw new ApiError(body.message || "The request could not be completed.", response.status, body.error);
  }
  return payload as T;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "" && value !== false) search.set(key, String(value));
  const text = search.toString();
  return text ? "?" + text : "";
};

export type Role = "owner" | "admin" | "manager" | "member" | "viewer";
export type Permissions = Record<"read" | "task:write" | "note:write" | "document:write" | "customer:write" | "project:write" | "data:export" | "team:manage" | "workspace:manage", boolean>;

export type Workspace = { id: string; name: string; slug: string; createdAt: string; isDemo: boolean; memberCount: number; role: Role; permissions: Permissions };
export type ActivityItem = { id: string; summary: string; action: string; entityType: string; entityId: string | null; createdAt: string; actorName: string | null };
export type UpcomingTask = { id: string; title: string; dueDate: string | null; priority: string; status: string; projectName: string | null; assigneeName: string | null; overdue: boolean };
export type Dashboard = {
  customers: number; documents: number;
  projects: { total: number; active: number };
  tasks: { open: number; overdue: number; dueThisWeek: number; mine: number; completedThisWeek: number; byStatus: Record<TaskStatus, number> };
  upcoming: UpcomingTask[]; activity: ActivityItem[];
};

export type CustomerStatus = "lead" | "active" | "inactive";
export type Customer = { id: string; name: string; email: string | null; company: string | null; phone: string | null; status: CustomerStatus; createdAt: string; updatedAt: string; archivedAt: string | null; projectCount?: number };
export type CustomerInput = { name: string; email?: string; company?: string; phone?: string; status?: CustomerStatus };
export type CustomerNote = { id: string; body: string; createdAt: string; authorId: string | null; authorName: string | null };
export type CustomerDetail = Customer & { notes: CustomerNote[]; projects: { id: string; name: string; status: ProjectStatus; dueDate: string | null }[] };
export type CustomerPage = { data: Customer[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed";
export type Project = { id: string; name: string; description: string | null; status: ProjectStatus; dueDate: string | null; customerId: string | null; customerName: string | null; createdAt: string; updatedAt: string; archivedAt: string | null; progress: { total: number; done: number } };
export type ProjectInput = { name: string; description?: string; status?: ProjectStatus; customerId?: string | null; dueDate?: string | null };
export type ProjectDetail = Project & { tasks: Task[] };

export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type Task = { id: string; title: string; description?: string | null; status: TaskStatus; priority: TaskPriority; projectId?: string | null; projectName?: string | null; assigneeId: string | null; assigneeName: string | null; dueDate: string | null; position: number; createdAt?: string; updatedAt?: string; completedAt: string | null };
export type TaskInput = { title: string; description?: string; status?: TaskStatus; priority?: TaskPriority; projectId?: string | null; assigneeId?: string | null; dueDate?: string | null };

export type DocumentSummary = { id: string; title: string; excerpt: string; projectId: string | null; projectName: string | null; updatedAt: string; updatedByName: string | null };
export type DocumentDetail = { id: string; title: string; body: string; projectId: string | null; projectName: string | null; createdBy: string | null; createdAt: string; updatedAt: string; updatedByName: string | null };

export type Member = { id: string; userId: string; role: Role; joinedAt: string; name: string; email: string };
export type Invitation = { id: string; email: string; role: Role; expiresAt: string; createdAt: string };
export type Team = { members: Member[]; invitations: Invitation[]; me: { userId: string; role: Role; permissions: Permissions } };
export type Option = { id: string; name: string };

export type Reports = {
  tasksByStatus: Partial<Record<TaskStatus, number>>; openByPriority: Partial<Record<TaskPriority, number>>;
  trend: { week: string; created: number; completed: number }[];
  projects: { id: string; name: string; status: ProjectStatus; dueDate: string | null; total: number; done: number }[];
  workload: { name: string; total: number }[]; customersByStatus: Partial<Record<CustomerStatus, number>>;
};
export type SearchHit = { id: string; title: string; subtitle: string | null };
export type SearchResults = { customers: SearchHit[]; projects: SearchHit[]; tasks: SearchHit[]; documents: SearchHit[] };

export const api = {
  workspace: (signal?: AbortSignal) => request<{ data: Workspace }>("/api/workspace", { signal }),
  renameWorkspace: (name: string) => request<{ data: { id: string; name: string } }>("/api/workspace", json("PATCH", { name })),
  sampleData: () => request<{ data: { seeded: boolean } }>("/api/workspace/sample-data", json("POST")),
  dashboard: (signal?: AbortSignal) => request<{ data: Dashboard }>("/api/workspace/dashboard", { signal }),
  activity: (before?: string, signal?: AbortSignal) => request<{ data: ActivityItem[] }>("/api/workspace/activity" + qs({ before, limit: 40 }), { signal }),
  startDemo: () => request<{ data: { organizationId: string } }>("/api/demo", json("POST")),

  customers: (params: { search?: string; page?: number; pageSize?: number; archived?: boolean; status?: string }, signal?: AbortSignal) =>
    request<CustomerPage>("/api/customers" + qs(params), { signal }),
  customerOptions: () => request<{ data: { id: string; name: string; company: string | null }[] }>("/api/customers/options"),
  customer: (id: string, signal?: AbortSignal) => request<{ data: CustomerDetail }>("/api/customers/" + encodeURIComponent(id), { signal }),
  createCustomer: (input: CustomerInput) => request<{ data: Customer }>("/api/customers", json("POST", input)),
  updateCustomer: (id: string, input: Partial<CustomerInput>) => request<{ data: Customer }>("/api/customers/" + encodeURIComponent(id), json("PATCH", input)),
  archiveCustomer: (id: string) => request("/api/customers/" + encodeURIComponent(id) + "/archive", json("POST")),
  restoreCustomer: (id: string) => request("/api/customers/" + encodeURIComponent(id) + "/restore", json("POST")),
  addNote: (id: string, body: string) => request<{ data: CustomerNote }>("/api/customers/" + encodeURIComponent(id) + "/notes", json("POST", { body })),
  deleteNote: (id: string, noteId: string) => request("/api/customers/" + encodeURIComponent(id) + "/notes/" + encodeURIComponent(noteId), json("DELETE")),

  projects: (params: { search?: string; status?: string; archived?: boolean; customerId?: string } = {}, signal?: AbortSignal) =>
    request<{ data: Project[] }>("/api/projects" + qs(params), { signal }),
  projectOptions: () => request<{ data: { id: string; name: string; status: ProjectStatus }[] }>("/api/projects/options"),
  project: (id: string, signal?: AbortSignal) => request<{ data: ProjectDetail }>("/api/projects/" + encodeURIComponent(id), { signal }),
  createProject: (input: ProjectInput) => request<{ data: { id: string; name: string } }>("/api/projects", json("POST", input)),
  updateProject: (id: string, input: Partial<ProjectInput>) => request("/api/projects/" + encodeURIComponent(id), json("PATCH", input)),
  archiveProject: (id: string) => request("/api/projects/" + encodeURIComponent(id) + "/archive", json("POST")),
  restoreProject: (id: string) => request("/api/projects/" + encodeURIComponent(id) + "/restore", json("POST")),

  tasks: (params: { search?: string; projectId?: string; assignee?: string; priority?: string; status?: string; due?: string } = {}, signal?: AbortSignal) =>
    request<{ data: Task[] }>("/api/tasks" + qs(params), { signal }),
  task: (id: string) => request<{ data: Task }>("/api/tasks/" + encodeURIComponent(id)),
  createTask: (input: TaskInput) => request<{ data: { id: string; title: string } }>("/api/tasks", json("POST", input)),
  updateTask: (id: string, input: Partial<TaskInput>) => request<{ data: { id: string; status: TaskStatus } }>("/api/tasks/" + encodeURIComponent(id), json("PATCH", input)),
  moveTask: (id: string, status: TaskStatus, position: number) => request("/api/tasks/" + encodeURIComponent(id) + "/move", json("POST", { status, position })),
  deleteTask: (id: string) => request("/api/tasks/" + encodeURIComponent(id), json("DELETE")),

  documents: (params: { search?: string; projectId?: string } = {}, signal?: AbortSignal) => request<{ data: DocumentSummary[] }>("/api/documents" + qs(params), { signal }),
  document: (id: string, signal?: AbortSignal) => request<{ data: DocumentDetail }>("/api/documents/" + encodeURIComponent(id), { signal }),
  createDocument: (input: { title: string; body?: string; projectId?: string | null }) => request<{ data: { id: string } }>("/api/documents", json("POST", input)),
  updateDocument: (id: string, input: { title?: string; body?: string; projectId?: string | null }) => request<{ data: { id: string; updatedAt: string } }>("/api/documents/" + encodeURIComponent(id), json("PATCH", input)),
  deleteDocument: (id: string) => request("/api/documents/" + encodeURIComponent(id), json("DELETE")),

  team: (signal?: AbortSignal) => request<{ data: Team }>("/api/team", { signal }),
  memberOptions: () => request<{ data: { id: string; name: string; email: string }[] }>("/api/team/options"),
  invite: (email: string, role: Role) => request<{ data: Invitation }>("/api/team/invitations", json("POST", { email, role })),
  cancelInvite: (id: string) => request("/api/team/invitations/" + encodeURIComponent(id), json("DELETE")),
  changeRole: (memberId: string, role: Role) => request("/api/team/members/" + encodeURIComponent(memberId), json("PATCH", { role })),
  removeMember: (memberId: string) => request<{ data: { id: string; left: boolean } }>("/api/team/members/" + encodeURIComponent(memberId), json("DELETE")),
  invitation: (id: string) => request<{ data: { id: string; role: Role; status: string; expired: boolean; emailMatches: boolean; organizationName: string; inviterName: string | null; email: string } }>("/api/invitations/" + encodeURIComponent(id)),
  acceptInvitation: (id: string) => request<{ data: { organizationId: string } }>("/api/invitations/" + encodeURIComponent(id) + "/accept", json("POST")),

  reports: (signal?: AbortSignal) => request<{ data: Reports }>("/api/reports", { signal }),
  search: (q: string, signal?: AbortSignal) => request<{ data: SearchResults }>("/api/search" + qs({ q }), { signal }),
  exportUrl: (entity: "customers" | "projects" | "tasks") => "/api/export/" + entity + ".csv",
};
