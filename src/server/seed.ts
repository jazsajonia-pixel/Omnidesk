import { randomUUID } from "node:crypto";
import { requireDb } from "./db/client.js";
import { activity, customerNotes, customers, documents, projects, tasks } from "./db/schema.js";

const DAY = 86_400_000;
const isoDay = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000);

/**
 * Fill a workspace with a realistic, clearly fictional small-agency dataset so
 * new users and portfolio visitors can explore every module.
 */
export async function seedWorkspace(options: { organizationId: string; ownerId: string; teammateIds?: string[] }) {
  const { organizationId: org, ownerId } = options;
  const team = [ownerId, ...(options.teammateIds ?? [])];
  const who = (index: number) => team[index % team.length];
  const database = requireDb();
  const id = () => randomUUID();

  const customerSeed = [
    { name: "Harbor & Pine Coffee", email: "hello@harborpine.example", company: "Harbor & Pine", phone: "+63 917 555 0142", status: "active", age: 40 },
    { name: "Dr. Lena Ortiz", email: "lena@brightsmile.example", company: "BrightSmile Dental", phone: "+63 918 555 0199", status: "active", age: 33 },
    { name: "Marco Villanueva", email: "marco@tidewater.example", company: "Tidewater Logistics", phone: "+63 920 555 0110", status: "active", age: 28 },
    { name: "Aiko Tanaka", email: "aiko@kumo.example", company: "Kumo Tea House", phone: "+63 915 555 0177", status: "lead", age: 9 },
    { name: "Ravi Menon", email: "ravi@fieldnote.example", company: "Fieldnote Books", phone: null, status: "lead", age: 4 },
    { name: "Grace Lim", email: "grace@summitfit.example", company: "Summit Fitness", phone: "+63 927 555 0135", status: "active", age: 21 },
    { name: "Oliver Brandt", email: "oliver@brandtarch.example", company: "Brandt Architecture", phone: null, status: "inactive", age: 60 },
  ];
  const customerRows = customerSeed.map((c) => ({
    id: id(), organizationId: org, name: c.name, email: c.email, company: c.company, phone: c.phone, status: c.status,
    createdAt: ago(c.age), updatedAt: ago(Math.max(0, c.age - 3)),
  }));
  await database.insert(customers).values(customerRows);
  const cust = (name: string) => customerRows.find((c) => c.company === name)!.id;

  const projectSeed = [
    { key: "web", name: "Harbor & Pine website refresh", customer: "Harbor & Pine", status: "active", due: 12, age: 30,
      description: "Rebuild the café's site with online ordering, a seasonal menu page and better mobile performance." },
    { key: "dental", name: "BrightSmile patient booking", customer: "BrightSmile Dental", status: "active", due: 24, age: 26,
      description: "Replace phone-only bookings with an online scheduler and automated reminders." },
    { key: "logistics", name: "Tidewater driver handbook", customer: "Tidewater Logistics", status: "on_hold", due: 40, age: 20,
      description: "Turn the scattered safety PDFs into one searchable handbook. Waiting on legal review." },
    { key: "brand", name: "Summit Fitness brand kit", customer: "Summit Fitness", status: "completed", due: -3, age: 21,
      description: "Logo refresh, colour palette, social templates and a one-page brand guide." },
    { key: "kumo", name: "Kumo Tea launch campaign", customer: "Kumo Tea House", status: "planning", due: 35, age: 6,
      description: "Opening-week campaign: landing page, launch email and three short social videos." },
  ];
  const projectRows = projectSeed.map((p) => ({
    id: id(), organizationId: org, customerId: cust(p.customer), name: p.name, description: p.description, status: p.status,
    dueDate: isoDay(p.due), createdBy: ownerId, createdAt: ago(p.age), updatedAt: ago(Math.max(0, p.age - 5)),
  }));
  await database.insert(projects).values(projectRows);
  const proj = (key: string) => projectRows[projectSeed.findIndex((p) => p.key === key)].id;

  type TaskSeed = [string, string, string, string, number | null, number, string?];
  // [project, title, status, priority, due offset, assignee index, description]
  const taskSeed: TaskSeed[] = [
    ["web", "Finalize homepage wireframe", "done", "high", -6, 0, "Approved by the client on the review call."],
    ["web", "Write seasonal menu copy", "review", "medium", 2, 1],
    ["web", "Connect online ordering provider", "in_progress", "urgent", 4, 0, "Use the provider's hosted checkout; no card data on our side."],
    ["web", "Compress and convert product photos", "todo", "medium", 6, 2],
    ["web", "Accessibility pass on the menu page", "todo", "high", 9, 1],
    ["dental", "Map current booking workflow", "done", "medium", -10, 2],
    ["dental", "Choose scheduling provider", "done", "high", -5, 0],
    ["dental", "Design reminder SMS templates", "in_progress", "medium", 3, 1],
    ["dental", "Staff training session", "todo", "low", 18, 2],
    ["dental", "Confirm patient-data handling with clinic", "todo", "urgent", -1, 0, "Overdue: the clinic asked for this before go-live."],
    ["logistics", "Collect all current safety PDFs", "done", "medium", -12, 2],
    ["logistics", "Draft handbook outline", "review", "medium", 5, 1],
    ["brand", "Logo refresh concepts", "done", "high", -14, 1],
    ["brand", "Social media templates", "done", "medium", -8, 2],
    ["brand", "One-page brand guide", "done", "medium", -4, 0],
    ["kumo", "Kickoff call with Aiko", "todo", "high", 1, 0],
    ["kumo", "Moodboard for launch visuals", "todo", "medium", 8, 1],
    ["", "Send October invoices", "in_progress", "high", 0, 0],
    ["", "Update agency rate card", "todo", "low", 14, 0],
    ["", "Quarterly backup check", "todo", "medium", -2, 2],
  ];
  const positions = new Map<string, number>();
  const taskRows = taskSeed.map(([project, title, status, priority, due, assignee, description], index) => {
    const position = positions.get(status) ?? 0;
    positions.set(status, position + 1);
    const createdAt = ago(20 - Math.floor(index / 2));
    return {
      id: id(), organizationId: org, projectId: project ? proj(project) : null, title, description: description ?? null,
      status, priority, assigneeId: who(assignee), dueDate: due === null ? null : isoDay(due), position, createdBy: ownerId,
      createdAt, updatedAt: createdAt, completedAt: status === "done" ? ago(Math.max(0, -(due ?? 0)) % 21, 2) : null,
    };
  });
  await database.insert(tasks).values(taskRows);

  await database.insert(customerNotes).values([
    { id: id(), organizationId: org, customerId: cust("Harbor & Pine"), authorId: who(0), body: "Prefers updates by email on Fridays. Wants the new menu live before the holiday season.", createdAt: ago(12) },
    { id: id(), organizationId: org, customerId: cust("Harbor & Pine"), authorId: who(1), body: "Shared the photo shoot schedule. They'll send product shots next week.", createdAt: ago(3) },
    { id: id(), organizationId: org, customerId: cust("BrightSmile Dental"), authorId: who(0), body: "Clinic manager is the main contact for scheduling; Dr. Ortiz signs off on patient-facing copy.", createdAt: ago(9) },
    { id: id(), organizationId: org, customerId: cust("Kumo Tea House"), authorId: who(0), body: "Warm lead from a referral. Opening is planned for next month.", createdAt: ago(5) },
  ]);

  await database.insert(documents).values([
    { id: id(), organizationId: org, projectId: proj("web"), title: "Website refresh — project brief", createdBy: ownerId, updatedBy: who(1), createdAt: ago(28), updatedAt: ago(2),
      body: "# Goals\n- Make ordering possible on mobile in under a minute\n- Show the seasonal menu without a PDF\n- Load in under 2 seconds on 4G\n\n# Scope\nHomepage, menu, ordering, about and contact pages.\n\n# Out of scope\nLoyalty program and gift cards (phase 2)." },
    { id: id(), organizationId: org, projectId: null, title: "Client onboarding checklist", createdBy: ownerId, updatedBy: ownerId, createdAt: ago(45), updatedAt: ago(10),
      body: "1. Signed proposal and deposit\n2. Kickoff call booked\n3. Shared folder created\n4. Main contact and approver confirmed\n5. Project added to OmniDesk with a due date" },
    { id: id(), organizationId: org, projectId: proj("dental"), title: "Booking flow — meeting notes", createdBy: who(2), updatedBy: who(2), createdAt: ago(8), updatedAt: ago(8),
      body: "Attendees: clinic manager, Dr. Ortiz\n\n- Patients should pick a dentist first, then a time\n- Reminder 24 hours before, by SMS\n- Cancellations must free the slot immediately" },
  ]);

  const events: [number, number, string, string, string][] = [
    [0, 26, "project.created", "project", "created project BrightSmile patient booking"],
    [1, 14, "task.completed", "task", "completed Logo refresh concepts"],
    [2, 10, "task.completed", "task", "completed Map current booking workflow"],
    [0, 6, "project.created", "project", "created project Kumo Tea launch campaign"],
    [0, 5, "customer.note_added", "customer", "added a note to Aiko Tanaka"],
    [0, 4, "project.updated", "project", "moved project Summit Fitness brand kit to Completed"],
    [1, 3, "customer.note_added", "customer", "added a note to Harbor & Pine Coffee"],
    [1, 1, "task.moved", "task", "moved Write seasonal menu copy to In review"],
    [0, 0, "task.moved", "task", "moved Connect online ordering provider to In progress"],
  ];
  await database.insert(activity).values(events.map(([actor, days, action, entityType, summary], index) => ({
    id: id(), organizationId: org, actorId: who(actor), action, entityType, entityId: null, summary, createdAt: ago(days, index % 5 + 1),
  })));
}
