import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, PenLine, Save, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { errorMessage, relativeTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useWorkspace } from "../lib/workspace";
import { Button, ConfirmDialog, ErrorState, Segmented, Skeleton } from "../components/ui";
import { Markdown } from "../components/Markdown";
import { useTaskOptions } from "../components/TaskDialog";

export default function DocumentPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { can, notify, bumpData } = useWorkspace();
  const options = useTaskOptions();
  const canWrite = can("document:write");
  const { data, error, loading, reload, setData } = useAsync((signal) => api.document(id, signal).then((r) => r.data), [id]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [projectId, setProjectId] = useState("");
  const [mode, setMode] = useState<"write" | "preview">(params.get("new") || !canWrite ? (canWrite ? "write" : "preview") : "preview");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => { if (data) { setTitle(data.title); setBody(data.body); setProjectId(data.projectId ?? ""); } }, [data]);
  const dirty = Boolean(data) && (title !== data!.title || body !== data!.body || projectId !== (data!.projectId ?? ""));

  const save = useCallback(async () => {
    if (!data || !dirty || !title.trim()) return;
    setSaving(true);
    try {
      const r = await api.updateDocument(id, { title: title.trim(), body, projectId: projectId || null });
      setData({ ...data, title: title.trim(), body, projectId: projectId || null, projectName: options.projects.find((p) => p.id === projectId)?.name ?? null, updatedAt: r.data.updatedAt });
      notify("Document saved");
      bumpData();
    } catch (reason) { notify(errorMessage(reason), "error"); }
    finally { setSaving(false); }
  }, [body, bumpData, data, dirty, id, notify, options.projects, projectId, setData, title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); } };
    const onUnload = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onUnload); };
  }, [dirty, save]);

  async function remove() {
    setDeleting(true);
    try { await api.deleteDocument(id); notify("Document deleted"); bumpData(); navigate("/documents"); }
    catch (reason) { notify(errorMessage(reason), "error"); setDeleting(false); setConfirm(false); }
  }

  if (error) return <div className="stack"><Link className="text-link back" to="/documents"><ArrowLeft size={15}/> Documents</Link><ErrorState message={error} onRetry={reload}/></div>;
  if (loading && !data) return <Skeleton rows={10}/>;
  if (!data) return null;

  return <div className="stack doc-page">
    <div className="doc-bar">
      <Link className="text-link back" to="/documents"><ArrowLeft size={15}/> Documents</Link>
      <span className="muted small doc-meta">{dirty ? "Unsaved changes" : "Saved " + relativeTime(data.updatedAt) + (data.updatedByName ? " by " + data.updatedByName : "")}</span>
      {canWrite && <div className="row-actions">
        <Segmented label="Editor mode" value={mode} onChange={setMode} options={[{ value: "write", label: "Write" }, { value: "preview", label: "Preview" }]}/>
        <Button variant="ghost" icon={<Trash2 size={16}/>} className="danger-text" onClick={() => setConfirm(true)}>Delete</Button>
        <Button variant="primary" icon={<Save size={16}/>} busy={saving} disabled={!dirty || !title.trim()} onClick={() => void save()}>Save</Button>
      </div>}
    </div>
    <article className="card doc-sheet">
      {canWrite && mode === "write" ? <>
        <input className="doc-title-input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} aria-label="Document title" placeholder="Document title"/>
        <div className="doc-props"><label>Project <select className="select-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Not linked</option>{options.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <span className="muted small"><PenLine size={13}/> Markdown: # heading, **bold**, - list, [ ] checklist, `code`, [link](https://…)</span></div>
        <div className="editor-split">
          <textarea className="doc-editor" value={body} maxLength={100000} onChange={(e) => setBody(e.target.value)} placeholder="Start writing…" aria-label="Document body"/>
          <div className="doc-live" aria-label="Live preview"><span className="eyebrow"><Eye size={13}/> Preview</span><Markdown source={body || "_Nothing to preview yet._"}/></div>
        </div>
      </> : <>
        <h1 className="doc-title">{data.title}</h1>
        <p className="muted small">{data.projectId ? <Link to={"/projects/" + data.projectId}>{data.projectName}</Link> : "Not linked to a project"}</p>
        {body.trim() ? <Markdown source={body}/> : <p className="muted">This document is empty.</p>}
      </>}
    </article>
    {confirm && <ConfirmDialog title="Delete this document?" message={<>"{data.title}" will be permanently removed.</>} confirmLabel="Delete document" busy={deleting} onCancel={() => setConfirm(false)} onConfirm={() => void remove()}/>}
  </div>;
}
