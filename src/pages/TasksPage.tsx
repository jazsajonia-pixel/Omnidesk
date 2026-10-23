import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, CheckSquare, Columns3, Download, List, Plus, Search, X } from "lucide-react";
import { api, type Task, type TaskStatus } from "../lib/api";
import { TASK_PRIORITIES, TASK_STATUSES, dueLabel, errorMessage, label } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useWorkspace } from "../lib/workspace";
import { Avatar, Badge, Button, EmptyState, ErrorState, IconButton, PageHeader, Segmented, Skeleton } from "../components/ui";
import { TaskDialog, useTaskOptions } from "../components/TaskDialog";

type View = "board" | "list";
const VIEW_KEY = "omnidesk-task-view";

function TaskCard({ task, draggable, onOpen, onDragStart, onDragEnd, dragging }: { task: Task; draggable: boolean; onOpen: () => void; onDragStart: (e: DragEvent) => void; onDragEnd: () => void; dragging: boolean }) {
  const due = dueLabel(task.dueDate, task.status === "done");
  return <article className={"task-card" + (dragging ? " dragging" : "") + (task.status === "done" ? " is-done" : "")} draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} data-task-id={task.id}>
    <button type="button" className="task-card-button" onClick={onOpen}>
      <span className="task-card-top"><span className={"prio prio-" + task.priority}>{label(TASK_PRIORITIES, task.priority)}</span>{task.projectName && <span className="task-project">{task.projectName}</span>}</span>
      <strong>{task.title}</strong>
      <span className="task-card-foot">
        {task.dueDate ? <span className={"due due-" + due.tone}><CalendarDays size={13}/>{due.text}</span> : <span className="muted small">No due date</span>}
        {task.assigneeName ? <Avatar name={task.assigneeName} size={24}/> : <span className="avatar-empty" title="Unassigned"/>}
      </span>
    </button>
  </article>;
}

export default function TasksPage() {
  const { can, notify, bumpData, dataVersion } = useWorkspace();
  const options = useTaskOptions();
  const [params, setParams] = useSearchParams();
  const [view, setViewState] = useState<View>(() => (localStorage.getItem(VIEW_KEY) as View) || "board");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Task | { status: TaskStatus } | null>(null);
  const [dragId, setDragIdState] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);
  const setDragId = (id: string | null) => { dragRef.current = id; setDragIdState(id); };
  const [dropTarget, setDropTarget] = useState<{ status: TaskStatus; index: number } | null>(null);
  const project = params.get("project") ?? "";
  const assignee = params.get("assignee") ?? "";
  const priority = params.get("priority") ?? "";
  const due = params.get("due") ?? "";
  const openId = params.get("open");
  const setView = (v: View) => { setViewState(v); localStorage.setItem(VIEW_KEY, v); };
  const setFilter = (key: string, value: string) => setParams((current) => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); next.delete("open"); return next; });
  const filtersActive = Boolean(project || assignee || priority || due || search);

  useEffect(() => { const t = window.setTimeout(() => setSearch(searchInput.trim()), 250); return () => window.clearTimeout(t); }, [searchInput]);
  const { data, error, loading, reload, setData } = useAsync((signal) => api.tasks({ search, projectId: project, assignee, priority, due }, signal).then((r) => r.data), [search, project, assignee, priority, due, dataVersion]);

  useEffect(() => {
    if (!openId) return;
    const found = data?.find((t) => t.id === openId);
    if (found) { setDialog(found); return; }
    if (data) api.task(openId).then((r) => setDialog(r.data)).catch(() => notify("That task no longer exists.", "error"));
  }, [openId, data, notify]);

  const columns = useMemo(() => TASK_STATUSES.map((s) => ({ ...s, tasks: (data ?? []).filter((t) => t.status === s.value).sort((a, b) => a.position - b.position) })), [data]);
  const canWrite = can("task:write");

  function closeDialog() {
    setDialog(null);
    if (openId) setParams((current) => { const next = new URLSearchParams(current); next.delete("open"); return next; });
  }

  function indexFromPointer(event: DragEvent<HTMLElement>, status: TaskStatus) {
    const cards = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-task-id]")].filter((el) => el.dataset.taskId !== dragRef.current);
    const index = cards.findIndex((card) => { const rect = card.getBoundingClientRect(); return event.clientY < rect.top + rect.height / 2; });
    return { status, index: index === -1 ? cards.length : index };
  }

  async function drop(status: TaskStatus, visibleIndex: number) {
    const task = data?.find((t) => t.id === dragRef.current);
    setDragId(null);
    setDropTarget(null);
    if (!task || !data) return;
    const column = columns.find((c) => c.value === status)!.tasks.filter((t) => t.id !== task.id);
    const current = columns.find((c) => c.value === task.status)!.tasks.findIndex((t) => t.id === task.id);
    if (task.status === status && current === visibleIndex) return;
    // Translate the visible slot into the server's full-column index (filters can hide tasks).
    const before = column[visibleIndex];
    let position = before ? before.position : (column.at(-1)?.position ?? -1) + 1;
    if (task.status === status && before && task.position < before.position) position -= 1;
    position = Math.max(0, position);
    const previous = data;
    const reordered = [...column];
    reordered.splice(visibleIndex, 0, { ...task, status });
    const others = data.filter((t) => t.status !== status && t.id !== task.id);
    setData([...others, ...reordered.map((t, i) => ({ ...t, position: i }))]);
    try {
      await api.moveTask(task.id, status, position);
      if (task.status !== status) notify(status === "done" ? "Nice — task completed" : "Moved to " + label(TASK_STATUSES, status));
      bumpData();
    } catch (reason) { setData(previous); notify(errorMessage(reason), "error"); }
  }

  async function quickStatus(task: Task, status: TaskStatus) {
    try { await api.updateTask(task.id, { status }); bumpData(); }
    catch (reason) { notify(errorMessage(reason), "error"); }
  }

  return <div className="stack">
    <PageHeader eyebrow="Tasks" title="Tasks" description={canWrite ? "Drag cards between columns to update their status." : "Everything your team is working on."}
      actions={<>
        {can("data:export") && <a className="btn btn-secondary" href={api.exportUrl("tasks")} download><Download size={16}/><span>Export CSV</span></a>}
        {canWrite && <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setDialog({ status: "todo" })}>New task</Button>}
      </>}/>
    <div className="toolbar card">
      <label className="search-field"><Search size={16} aria-hidden/><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search tasks" aria-label="Search tasks"/>{searchInput && <IconButton label="Clear search" className="sm" onClick={() => setSearchInput("")}><X size={14}/></IconButton>}</label>
      <select className="select-sm" value={assignee} onChange={(e) => setFilter("assignee", e.target.value)} aria-label="Filter by assignee">
        <option value="">Everyone</option><option value="me">Assigned to me</option><option value="none">Unassigned</option>
        {options.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <select className="select-sm" value={project} onChange={(e) => setFilter("project", e.target.value)} aria-label="Filter by project">
        <option value="">All projects</option><option value="none">No project</option>{options.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select className="select-sm" value={priority} onChange={(e) => setFilter("priority", e.target.value)} aria-label="Filter by priority">
        <option value="">Any priority</option>{TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      <select className="select-sm" value={due} onChange={(e) => setFilter("due", e.target.value)} aria-label="Filter by due date">
        <option value="">Any due date</option><option value="overdue">Overdue</option><option value="week">Due this week</option>
      </select>
      {filtersActive && <Button size="sm" variant="ghost" onClick={() => { setSearchInput(""); setParams({}); }}>Clear filters</Button>}
      <span className="toolbar-end"><Segmented label="Layout" value={view} onChange={setView} options={[{ value: "board", label: "Board" }, { value: "list", label: "List" }]}/></span>
    </div>
    {error && <ErrorState message={error} onRetry={reload}/>}
    {loading && !data && <div className="board">{TASK_STATUSES.map((s) => <div key={s.value} className="column"><Skeleton rows={3}/></div>)}</div>}
    {data && data.length === 0 && !filtersActive && <div className="card"><EmptyState icon={<CheckSquare size={20}/>} title="No tasks yet" action={canWrite && <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setDialog({ status: "todo" })}>Create a task</Button>}>Tasks can belong to a project, have an owner, a priority and a due date.</EmptyState></div>}
    {data && (data.length > 0 || filtersActive) && view === "board" && <div className="board" aria-label="Task board">
      {columns.map((col) => <section key={col.value} className={"column" + (dropTarget?.status === col.value ? " drop-active" : "")} aria-label={col.label}
        onDragOver={(e) => { if (!dragRef.current) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; const t = indexFromPointer(e, col.value); if (t.status !== dropTarget?.status || t.index !== dropTarget.index) setDropTarget(t); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
        onDrop={(e) => { e.preventDefault(); void drop(col.value, indexFromPointer(e, col.value).index); }}>
        <header className="column-head"><span className={"col-dot pipe-" + col.value}/><h2>{col.label}</h2><span className="count">{col.tasks.length}</span>
          {canWrite && <IconButton label={"Add task to " + col.label} className="sm" onClick={() => setDialog({ status: col.value })}><Plus size={15}/></IconButton>}</header>
        <div className="column-body">
          {col.tasks.map((task, index) => <div key={task.id}>
            {dropTarget?.status === col.value && dropTarget.index === index && dragId !== task.id && <div className="drop-marker"/>}
            <TaskCard task={task} draggable={canWrite} dragging={dragId === task.id} onOpen={() => setDialog(task)}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", task.id); setDragId(task.id); }}
              onDragEnd={() => { setDragId(null); setDropTarget(null); }}/>
          </div>)}
          {dropTarget?.status === col.value && dropTarget.index >= col.tasks.filter((t) => t.id !== dragId).length && <div className="drop-marker"/>}
          {col.tasks.length === 0 && <p className="column-empty">{filtersActive ? "No matching tasks" : "Nothing here yet"}</p>}
        </div>
      </section>)}
    </div>}
    {data && (data.length > 0 || filtersActive) && view === "list" && <section className="card flush">
      {data.length === 0 ? <EmptyState icon={<List size={20}/>} title="No matching tasks">Try clearing a filter.</EmptyState> :
        <div className="table tasks-table" role="table" aria-label="Tasks">
          <div className="table-head" role="row"><span role="columnheader">Task</span><span role="columnheader">Status</span><span role="columnheader">Priority</span><span role="columnheader">Due</span><span role="columnheader">Owner</span></div>
          {[...data].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")).map((task) => {
            const d = dueLabel(task.dueDate, task.status === "done");
            return <div key={task.id} role="row" className={"table-row" + (task.status === "done" ? " is-done" : "")}>
              <button type="button" role="cell" className="cell-main" onClick={() => setDialog(task)}><span><strong>{task.title}</strong><small>{task.projectName ?? "No project"}</small></span></button>
              <span role="cell">{canWrite ? <select className="select-sm" value={task.status} onChange={(e) => void quickStatus(task, e.target.value as TaskStatus)} aria-label={"Status of " + task.title}>{TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select> : <Badge>{label(TASK_STATUSES, task.status)}</Badge>}</span>
              <span role="cell"><span className={"prio prio-" + task.priority}>{label(TASK_PRIORITIES, task.priority)}</span></span>
              <span role="cell">{task.dueDate ? <Badge tone={d.tone}>{d.text}</Badge> : <span className="muted">—</span>}</span>
              <span role="cell" className="cell-owner">{task.assigneeName ? <><Avatar name={task.assigneeName} size={24}/><span>{task.assigneeName}</span></> : <span className="muted">Unassigned</span>}</span>
            </div>;
          })}
        </div>}
    </section>}
    {view === "board" && data && data.length > 0 && <p className="muted small hint-line"><Columns3 size={14}/> Tip: on touch devices, open a task to change its status.</p>}
    {dialog && <TaskDialog task={"id" in dialog ? dialog : null} defaults={"id" in dialog ? undefined : { status: dialog.status, projectId: project && project !== "none" ? project : undefined }} onClose={closeDialog} onSaved={() => { closeDialog(); bumpData(); }}/>}
  </div>;
}
