import type { CustomerStatus, ProjectStatus, Role, TaskPriority, TaskStatus } from "./api";

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" }, { value: "in_progress", label: "In progress" },
  { value: "review", label: "In review" }, { value: "done", label: "Done" },
];
export const TASK_PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" },
];
export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "planning", label: "Planning" }, { value: "active", label: "Active" }, { value: "on_hold", label: "On hold" }, { value: "completed", label: "Completed" },
];
export const CUSTOMER_STATUSES: { value: CustomerStatus; label: string }[] = [
  { value: "lead", label: "Lead" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
];
export const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "owner", label: "Owner", description: "Full control, including owners and admins." },
  { value: "admin", label: "Admin", description: "Manages the team, settings and all records." },
  { value: "manager", label: "Manager", description: "Manages customers, projects, tasks and exports." },
  { value: "member", label: "Member", description: "Works on tasks, notes and documents." },
  { value: "viewer", label: "Viewer", description: "Read-only access." },
];

export const label = (list: { value: string; label: string }[], value: string | null | undefined) => list.find((item) => item.value === value)?.label ?? value ?? "—";

export function formatDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00") : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, options).format(date);
}

export function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.round(hours / 24);
  if (days < 7) return days + "d ago";
  return formatDate(value, { month: "short", day: "numeric" });
}

export function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function dueLabel(dueDate: string | null, done = false) {
  if (!dueDate) return { text: "No due date", tone: "muted" as const };
  const today = todayIso();
  const days = Math.round((new Date(dueDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86_400_000);
  if (done) return { text: formatDate(dueDate, { month: "short", day: "numeric" }), tone: "muted" as const };
  if (days < 0) return { text: Math.abs(days) === 1 ? "1 day overdue" : Math.abs(days) + " days overdue", tone: "danger" as const };
  if (days === 0) return { text: "Due today", tone: "warning" as const };
  if (days === 1) return { text: "Due tomorrow", tone: "warning" as const };
  if (days < 7) return { text: "Due in " + days + " days", tone: "default" as const };
  return { text: "Due " + formatDate(dueDate, { month: "short", day: "numeric" }), tone: "muted" as const };
}

export function initials(name: string | null | undefined) {
  return (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Try again.") {
  return error instanceof Error && error.message ? error.message : fallback;
}
