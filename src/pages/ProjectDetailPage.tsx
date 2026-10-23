import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, ArrowLeft, CalendarDays, CheckSquare, Pencil, Plus } from "lucide-react";
import { api, type Task } from "../lib/api";
import { PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES, dueLabel, errorMessage, formatDate, label } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useWorkspace } from "../lib/workspace";
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton } from "../components/ui";
import { ProjectForm } from "../components/ProjectForm";
import { TaskDialog } from "../components/TaskDialog";

export default function ProjectDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { can, notify, bumpData, dataVersion } = useWorkspace();
  const { data: p, error, loading, reload } = useAsync((signal) => api.project(id, signal).then((r) => r.data), [id, dataVersion]);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taskDialog, setTaskDialog] = useState<Task | "new" | null>(null);

  async function archive() {
    setBusy(true);
    try { await api.archiveProject(id); notify("Project archived"); bumpData(); navigate("/projects"); }
    catch (reason) { notify(errorMessage(reason), "error"); setBusy(false); setArchiving(false); }
  }
  async function toggleDone(task: Task) {
    try { await api.updateTask(task.id, { status: task.status === "done" ? "todo" : "done" }); bumpData(); }
    catch (reason) { notify(errorMessage(reason), "error"); }
  }

  if (error) return <div className="stack"><Link className="text-link back" to="/projects"><ArrowLeft size={15}/> Projects</Link><ErrorState message={error} onRetry={reload}/></div>;
  if (loading && !p) return <div className="stack"><Skeleton rows={8}/></div>;
  if (!p) return null;
  const pct = p.progress.total ? Math.round((p.progress.done / p.progress.total) * 100) : 0;
  const due = dueLabel(p.dueDate, p.status === "completed");
  const groups = TASK_STATUSES.map((s) => ({ ...s, tasks: p.tasks.filter((t) => t.status === s.value) })).filter((g) => g.tasks.length);

  return <div className="stack">
    <Link className="text-link back" to="/projects"><ArrowLeft size={15}/> All projects</Link>
    <PageHeader eyebrow={p.customerName ?? "Internal project"} title={p.name} description={p.description || undefined}
      actions={<>
        {can("project:write") && !p.archivedAt && <Button variant="ghost" icon={<Archive size={16}/>} onClick={() => setArchiving(true)}>Archive</Button>}
        {can("project:write") && <Button icon={<Pencil size={16}/>} onClick={() => setEditing(true)}>Edit</Button>}
        {can("task:write") && <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setTaskDialog("new")}>Add task</Button>}
      </>}/>
    <section className="summary-grid">
      <div className="card summary"><span>Status</span><Badge tone={p.status}>{label(PROJECT_STATUSES, p.status)}</Badge></div>
      <div className="card summary"><span>Deadline</span><strong className={"due-" + due.tone}><CalendarDays size={15}/> {p.dueDate ? formatDate(p.dueDate) : "Not set"}</strong></div>
      <div className="card summary"><span>Customer</span>{p.customerId ? <Link to={"/customers?open=" + p.customerId}><strong>{p.customerName}</strong></Link> : <strong>Internal</strong>}</div>
      <div className="card summary wide"><span>Progress · {p.progress.done} of {p.progress.total} tasks</span><div className="progress-line"><ProgressBar value={p.progress.done} total={p.progress.total} label="Project progress"/><strong>{pct}%</strong></div></div>
    </section>
    <section className="card flush">
      <div className="card-head pad"><div><h2>Tasks</h2><p>Click a task to edit it, or tick it off.</p></div><Link className="text-link" to={"/tasks?project=" + p.id}>Open on board</Link></div>
      {p.tasks.length === 0 ? <EmptyState icon={<CheckSquare size={20}/>} title="No tasks yet" action={can("task:write") && <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setTaskDialog("new")}>Add the first task</Button>}>Break the project into concrete steps.</EmptyState> :
        groups.map((g) => <div key={g.value} className="task-group">
          <h3>{g.label} <span className="count">{g.tasks.length}</span></h3>
          <ul className="list">{g.tasks.map((t) => {
            const d = dueLabel(t.dueDate, t.status === "done");
            return <li key={t.id} className={"list-row task-line" + (t.status === "done" ? " is-done" : "")}>
              <input type="checkbox" checked={t.status === "done"} disabled={!can("task:write")} onChange={() => void toggleDone(t)} aria-label={(t.status === "done" ? "Reopen " : "Complete ") + t.title}/>
              <button type="button" className="grow plain" onClick={() => setTaskDialog(t)}><strong>{t.title}</strong><small>{label(TASK_PRIORITIES, t.priority)} priority</small></button>
              {t.dueDate && <Badge tone={d.tone}>{d.text}</Badge>}
              {t.assigneeName && <Avatar name={t.assigneeName} size={26}/>}
            </li>;
          })}</ul>
        </div>)}
    </section>
    {editing && <ProjectForm project={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); bumpData(); }}/>}
    {archiving && <ConfirmDialog title={"Archive " + p.name + "?"} message="It leaves the project list but keeps its tasks and history. You can restore it later." confirmLabel="Archive project" busy={busy} onCancel={() => setArchiving(false)} onConfirm={() => void archive()}/>}
    {taskDialog && <TaskDialog task={taskDialog === "new" ? null : { ...taskDialog, projectId: p.id }} defaults={{ projectId: p.id }} onClose={() => setTaskDialog(null)} onSaved={() => { setTaskDialog(null); bumpData(); }}/>}
  </div>;
}
