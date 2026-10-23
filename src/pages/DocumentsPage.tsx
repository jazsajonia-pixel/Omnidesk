import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Plus, Search, X } from "lucide-react";
import { api } from "../lib/api";
import { errorMessage, relativeTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useWorkspace } from "../lib/workspace";
import { Button, EmptyState, ErrorState, IconButton, PageHeader, Skeleton } from "../components/ui";
import { useTaskOptions } from "../components/TaskDialog";

export default function DocumentsPage() {
  const { can, notify, dataVersion } = useWorkspace();
  const navigate = useNavigate();
  const options = useTaskOptions();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("");
  const [creating, setCreating] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setSearch(searchInput.trim()), 250); return () => window.clearTimeout(t); }, [searchInput]);
  const { data, error, loading, reload } = useAsync((signal) => api.documents({ search, projectId }, signal).then((r) => r.data), [search, projectId, dataVersion]);

  async function create() {
    setCreating(true);
    try {
      const r = await api.createDocument({ title: "Untitled document", body: "", projectId: projectId && projectId !== "none" ? projectId : null });
      navigate("/documents/" + r.data.id + "?new=1");
    } catch (reason) { notify(errorMessage(reason), "error"); setCreating(false); }
  }

  return <div className="stack">
    <PageHeader eyebrow="Documents" title="Documents" description="Briefs, meeting notes and playbooks, written in Markdown."
      actions={can("document:write") && <Button variant="primary" busy={creating} icon={<Plus size={16}/>} onClick={() => void create()}>New document</Button>}/>
    <div className="toolbar card">
      <label className="search-field"><Search size={16} aria-hidden/><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search titles and content" aria-label="Search documents"/>{searchInput && <IconButton label="Clear search" className="sm" onClick={() => setSearchInput("")}><X size={14}/></IconButton>}</label>
      <select className="select-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Filter by project">
        <option value="">All projects</option><option value="none">Not linked</option>{options.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
    {error && <ErrorState message={error} onRetry={reload}/>}
    {loading && !data && <div className="card-grid">{[0, 1, 2].map((i) => <div key={i} className="card"><Skeleton rows={3}/></div>)}</div>}
    {data && data.length === 0 && <div className="card"><EmptyState icon={<FileText size={20}/>} title={search || projectId ? "No matching documents" : "No documents yet"}
      action={!search && !projectId && can("document:write") && <Button variant="primary" icon={<Plus size={16}/>} onClick={() => void create()}>Write the first one</Button>}>
      {search || projectId ? "Try a different search or project." : "Keep briefs and notes next to the work they describe."}</EmptyState></div>}
    {data && data.length > 0 && <div className="card-grid">
      {data.map((d) => <Link key={d.id} to={"/documents/" + d.id} className="card doc-card interactive">
        <span className="doc-icon"><FileText size={18}/></span>
        <h3>{d.title}</h3>
        <p>{d.excerpt || "Empty document"}</p>
        <footer><span>{d.projectName ?? "No project"}</span><span>Edited {relativeTime(d.updatedAt)}{d.updatedByName ? " by " + d.updatedByName.split(" ")[0] : ""}</span></footer>
      </Link>)}
    </div>}
  </div>;
}
