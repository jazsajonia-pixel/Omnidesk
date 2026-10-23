import { useEffect, useState, type FormEvent } from "react";
import { api, type Project, type ProjectInput, type ProjectStatus } from "../lib/api";
import { PROJECT_STATUSES, errorMessage } from "../lib/format";
import { useWorkspace } from "../lib/workspace";
import { Button, Field, Modal } from "./ui";

export function ProjectForm({ project, defaultCustomerId, onClose, onSaved }: { project: Project | null; defaultCustomerId?: string; onClose: () => void; onSaved: (id: string) => void }) {
  const { notify } = useWorkspace();
  const [customers, setCustomers] = useState<{ id: string; name: string; company: string | null }[]>([]);
  const [form, setForm] = useState<ProjectInput>({
    name: project?.name ?? "", description: project?.description ?? "", status: project?.status ?? "planning",
    customerId: project?.customerId ?? defaultCustomerId ?? "", dueDate: project?.dueDate ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.customerOptions().then((r) => setCustomers(r.data)).catch(() => undefined); }, []);
  const set = (key: keyof ProjectInput) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const input: ProjectInput = { name: form.name.trim(), description: form.description?.trim() ?? "", status: form.status, customerId: form.customerId || null, dueDate: form.dueDate || null };
    try {
      if (project) { await api.updateProject(project.id, input); notify("Project updated"); onSaved(project.id); }
      else { const r = await api.createProject(input); notify("Project created"); onSaved(r.data.id); }
    } catch (reason) { setError(errorMessage(reason)); setBusy(false); }
  }
  return <Modal title={project ? "Edit project" : "New project"} description="Group related tasks and documents under one goal." onClose={onClose} busy={busy} footer={<>
    <Button onClick={onClose} disabled={busy}>Cancel</Button>
    <Button variant="primary" type="submit" form="project-form" busy={busy}>{project ? "Save changes" : "Create project"}</Button>
  </>}>
    <form id="project-form" className="form-grid" onSubmit={submit}>
      <Field label="Name"><input required maxLength={160} value={form.name} onChange={set("name")} placeholder="Website relaunch"/></Field>
      <Field label="Description" optional><textarea rows={3} maxLength={4000} value={form.description} onChange={set("description")} placeholder="What does done look like?"/></Field>
      <div className="form-row">
        <Field label="Status"><select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}>{PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
        <Field label="Due date" optional><input type="date" value={form.dueDate ?? ""} onChange={set("dueDate")}/></Field>
      </div>
      <Field label="Customer" optional><select value={form.customerId ?? ""} onChange={set("customerId")}><option value="">Internal project</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.company ? c.name + " · " + c.company : c.name}</option>)}</select></Field>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
    </form>
  </Modal>;
}
