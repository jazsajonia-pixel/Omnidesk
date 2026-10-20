export type Customer = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type CustomerInput = {
  name: string;
  email?: string;
  company?: string;
};

export type CustomerPage = {
  data: Customer[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type DashboardSummary = { customers: number };

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "message" in payload
      ? String(payload.message)
      : "The request could not be completed.";
    throw new ApiError(detail, response.status);
  }
  return payload as T;
}

export async function listCustomers(options: {
  search?: string; page?: number; pageSize?: number; archived?: boolean; signal?: AbortSignal;
} = {}) {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    pageSize: String(options.pageSize ?? 10),
  });
  if (options.search?.trim()) params.set("search", options.search.trim());
  if (options.archived) params.set("archived", "true");
  return request<CustomerPage>("/api/customers?" + params.toString(), { signal: options.signal });
}

export async function createCustomer(input: CustomerInput) {
  return request<{ data: Customer }>("/api/customers", { method: "POST", body: JSON.stringify(input) });
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>) {
  return request<{ data: Customer }>("/api/customers/" + encodeURIComponent(id), {
    method: "PATCH", body: JSON.stringify(input),
  });
}

export async function archiveCustomer(id: string) {
  return request<{ data: Pick<Customer, "id" | "name" | "archivedAt"> }>("/api/customers/" + encodeURIComponent(id) + "/archive", { method: "POST" });
}

export async function restoreCustomer(id: string) {
  return request<{ data: Pick<Customer, "id" | "name" | "archivedAt"> }>("/api/customers/" + encodeURIComponent(id) + "/restore", { method: "POST" });
}

export async function getDashboardSummary(signal?: AbortSignal) {
  return request<DashboardSummary>("/api/dashboard/summary", { signal });
}
