import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BriefcaseBusiness, CalendarDays, Download, Plus, RotateCcw, Search, X } from "lucide-react";
import { api, type ProjectStatus } from "../lib/api";
import { PROJECT_STATUSES, dueLabel, errorMessage, label } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useWorkspace } from "../lib/workspace";
import { Badge, Button, EmptyState, ErrorState, IconButton, PageHeader, ProgressBar, Segmented, Skeleton } from "../components/ui";
import { ProjectForm } from "../components/ProjectForm";
import { useNavigate } from "react-router-dom";

export default function ProjectsPage() {
  const { can, notify, bumpData, dataVersion } = useWorkspace();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | ProjectStatus>("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [creating, setCreating] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setSearch(searchInput.trim()), 250); return () => window.clearTimeout(t); }, [searchInput]);
  const { data, error, loading, reload } = useAsync((signal) => api.projects({ search, status, archived: view === "archived" }, signal).then((r) => r.data), [search, status, view, dataVersion]);

  async function restore(id: string) {
    try { await api.restoreProject(id); notify("Project restored"); bumpData(); }
    catch (reason) { notify(errorMessage(reason), "error"); }
  }

  return <div className="stack">
    <PageHeader eyebrow="Projects" title="Projects" description="Every engagement with its progress, owner tasks and deadline."
      actions={<>
        {can("data:export") && <a className="btn btn-secondary" href={api.exportUrl("projects")} download><Download size={16}/><span>Export CSV</span></a>}
        {can("project:write") && <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setCreating(true)}>New project</Button>}
      </>}/>
    <div className="toolbar card">
      <label className="search-field"><Search size={16} aria-hidden/><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search projects" aria-label="Search projects"/>{searchInput && <IconButton label="Clear search" className="sm" onClick={() => setSearchInput("")}><X size={14}/></IconButton>}</label>
      <select className="select-sm" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | "")} aria-label="Filter by status">
        <option value="">All statuses</option>{PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <Segmented label="Project list" value={view} onChange={setView} options={[{ value: "active", label: "Current" }, { value: "archived", label: "Archived" }]}/>
    </div>
    {error && <ErrorState message={error} onRetry={reload}/>}
    {loading && !data && <div className="card-grid">{[0, 1, 2].map((i) => <div key={i} className="card"><Skeleton rows={4}/></div>)}</div>}
    {data && data.length === 0 && <div className="card"><EmptyState icon={<BriefcaseBusiness size={20}/>} title={search || status ? "No matching projects" : view === "archived" ? "No archived projects" : "No projects yet"}
      action={!search && !status && view === "active" && can("project:write") && <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setCreating(true)}>Create a project</Button>}>
      {search || status ? "Try a different search or filter." : view === "archived" ? "Archived projects appear here." : "Projects group tasks and documents for a customer or an internal goal."}
    </EmptyState></div>}
    {data && data.length > 0 && <div className="card-grid">
      {data.map((p) => {
        const due = dueLabel(p.dueDate, p.status === "completed");
        const pct = p.progress.total ? Math.round((p.progress.done / p.progress.total) * 100) : 0;
        const body = <>
          <div className="project-top"><Badge tone={p.status}>{label(PROJECT_STATUSES, p.status)}</Badge>{p.dueDate && <span className={"due due-" + due.tone}><CalendarDays size={13}/>{due.text}</span>}</div>
          <h3>{p.name}</h3>
          <p className="project-customer">{p.customerName ?? "Internal"}</p>
          {p.description && <p className="project-desc">{p.description}</p>}
          <div className="project-progress"><div><span>{p.progress.done}/{p.progress.total} tasks</span><strong>{pct}%</strong></div><ProgressBar value={p.progress.done} total={p.progress.total} label={p.name + " progress"}/></div>
        </>;
        return view === "archived" ? <div key={p.id} className="card project-card">{body}{can("project:write") && <Button size="sm" icon={<RotateCcw size={14}/>} onClick={() => void restore(p.id)}>Restore</Button>}</div>
          : <Link key={p.id} to={"/projects/" + p.id} className="card project-card interactive">{body}</Link>;
      })}
    </div>}
    {creating && <ProjectForm project={null} onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); bumpData(); navigate("/projects/" + id); }}/>}
  </div>;
}
