import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { api, type Task, type TaskInput, type TaskPriority, type TaskStatus } from "../lib/api";
import { TASK_PRIORITIES, TASK_STATUSES, errorMessage } from "../lib/format";
import { useWorkspace } from "../lib/workspace";
import { Button, ConfirmDialog, Field, Modal } from "./ui";

type Options = { projects: { id: string; name: string }[]; members: { id: string; name: string }[] };
let cachedOptions: { key: string; value: Options } | null = null;

export function useTaskOptions() {
  const { workspace, dataVersion } = useWorkspace();
  const key = workspace.id + ":" + dataVersion;
  const [options, setOptions] = useState<Options>(cachedOptions?.key === key ? cachedOptions.value : { projects: [], members: [] });
  useEffect(() => {
    if (cachedOptions?.key === key) return;
    let alive = true;
    Promise.all([api.projectOptions(), api.memberOptions()]).then(([projects, members]) => {
      const value = { projects: projects.data, members: members.data };
      cachedOptions = { key, value };
      if (alive) setOptions(value);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [key]);
  return options;
}

export function TaskDialog({ task, defaults, onClose, onSaved }: {
  task?: Task | null; defaults?: Partial<TaskInput>; onClose: () => void; onSaved: () => void;
}) {
  const { can, notify, user } = useWorkspace();
  const options = useTaskOptions();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? defaults?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? defaults?.priority ?? "medium");
  const [projectId, setProjectId] = useState(task?.projectId ?? defaults?.projectId ?? "");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? defaults?.assigneeId ?? user.id);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaults?.dueDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const readOnly = !can("task:write");

  useEffect(() => {
    if (!task || task.description !== undefined) return;
    api.task(task.id).then((result) => setDescription(result.data.description ?? "")).catch(() => undefined);
  }, [task]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const input: TaskInput = { title: title.trim(), description: description.trim(), status, priority, projectId: projectId || null, assigneeId: assigneeId || null, dueDate: dueDate || null };
    try {
      if (task) await api.updateTask(task.id, input);
      else await api.createTask(input);
      notify(task ? "Task updated" : "Task created");
      onSaved();
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't save the task."));
      setBusy(false);
    }
  }

  async function remove() {
    if (!task) return;
    setBusy(true);
    try {
      await api.deleteTask(task.id);
      notify("Task deleted");
      onSaved();
    } catch (reason) {
      setError(errorMessage(reason));
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  if (confirmDelete && task) return <ConfirmDialog title="Delete this task?" message={<>"{task.title}" will be permanently removed.</>} confirmLabel="Delete task" busy={busy} onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()}/>;

  return <Modal title={task ? (readOnly ? "Task details" : "Edit task") : "New task"} onClose={onClose} busy={busy} size="md" footer={<>
    {task && !readOnly && <Button variant="ghost" className="mr-auto danger-text" icon={<Trash2 size={16}/>} onClick={() => setConfirmDelete(true)} disabled={busy}>Delete</Button>}
    <Button onClick={onClose} disabled={busy}>{readOnly ? "Close" : "Cancel"}</Button>
    {!readOnly && <Button variant="primary" type="submit" form="task-form" busy={busy}>{task ? "Save changes" : "Create task"}</Button>}
  </>}>
    <form id="task-form" className="form-grid" onSubmit={submit}>
      <fieldset disabled={readOnly || busy} className="form-grid">
        <Field label="Title"><input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen?"/></Field>
        <Field label="Description" optional><textarea rows={3} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add details, links or acceptance criteria"/></Field>
        <div className="form-row">
          <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>{TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
          <Field label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>{TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
        </div>
        <div className="form-row">
          <Field label="Project" optional><select value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value)}><option value="">No project</option>{options.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Assignee" optional><select value={assigneeId ?? ""} onChange={(e) => setAssigneeId(e.target.value)}><option value="">Unassigned</option>{options.members.map((m) => <option key={m.id} value={m.id}>{m.id === user.id ? m.name + " (you)" : m.name}</option>)}</select></Field>
        </div>
        <Field label="Due date" optional><input type="date" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)}/></Field>
      </fieldset>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
    </form>
  </Modal>;
}
