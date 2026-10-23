import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Archive, ChevronLeft, ChevronRight, Download, Mail, Pencil, Phone, Plus, RotateCcw, Search, Trash2, Users, X } from "lucide-react";
import { api, type Customer, type CustomerDetail, type CustomerInput, type CustomerStatus } from "../lib/api";
import { CUSTOMER_STATUSES, PROJECT_STATUSES, errorMessage, formatDate, label, relativeTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useWorkspace } from "../lib/workspace";
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Modal, PageHeader, Segmented, Skeleton, Spinner } from "../components/ui";

const statusTone: Record<string, string> = { lead: "info", active: "success", inactive: "muted" };

function CustomerForm({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: (c: Customer) => void }) {
  const { notify } = useWorkspace();
  const [form, setForm] = useState<CustomerInput>({ name: customer?.name ?? "", email: customer?.email ?? "", company: customer?.company ?? "", phone: customer?.phone ?? "", status: customer?.status ?? "active" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof CustomerInput) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = { ...form, name: form.name.trim(), email: form.email?.trim(), company: form.company?.trim(), phone: form.phone?.trim() };
      const result = customer ? await api.updateCustomer(customer.id, input) : await api.createCustomer(input);
      notify(customer ? "Customer updated" : "Customer added");
      onSaved(result.data);
    } catch (reason) { setError(errorMessage(reason)); setBusy(false); }
  }
  return <Modal title={customer ? "Edit customer" : "Add a customer"} description="Keep the contact details your team needs." onClose={onClose} busy={busy} footer={<>
    <Button onClick={onClose} disabled={busy}>Cancel</Button>
    <Button variant="primary" type="submit" form="customer-form" busy={busy}>{customer ? "Save changes" : "Add customer"}</Button>
  </>}>
    <form id="customer-form" className="form-grid" onSubmit={submit}>
      <Field label="Name"><input required maxLength={160} value={form.name} onChange={set("name")} placeholder="Jordan Lee"/></Field>
      <div className="form-row">
        <Field label="Email" optional><input type="email" maxLength={254} value={form.email} onChange={set("email")} placeholder="jordan@company.com"/></Field>
        <Field label="Phone" optional><input type="tel" maxLength={40} value={form.phone} onChange={set("phone")} placeholder="+63 900 000 0000"/></Field>
      </div>
      <div className="form-row">
        <Field label="Company" optional><input maxLength={160} value={form.company} onChange={set("company")} placeholder="Company name"/></Field>
        <Field label="Status"><select value={form.status} onChange={set("status")}>{CUSTOMER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
    </form>
  </Modal>;
}

function CustomerPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { can, notify, user } = useWorkspace();
  const { data, error, loading, reload, setData } = useAsync((signal) => api.customer(id, signal).then((r) => r.data), [id]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !editing && !archiving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [archiving, editing, onClose]);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      const result = await api.addNote(id, note.trim());
      setData((d) => d ? { ...d, notes: [result.data, ...d.notes] } : d);
      setNote("");
    } catch (reason) { notify(errorMessage(reason), "error"); }
    finally { setSaving(false); }
  }
  async function deleteNote(noteId: string) {
    try {
      await api.deleteNote(id, noteId);
      setData((d) => d ? { ...d, notes: d.notes.filter((n) => n.id !== noteId) } : d);
    } catch (reason) { notify(errorMessage(reason), "error"); }
  }
  async function archive() {
    setBusy(true);
    try { await api.archiveCustomer(id); notify("Customer archived"); onChanged(); onClose(); }
    catch (reason) { notify(errorMessage(reason), "error"); setBusy(false); }
  }

  const c: CustomerDetail | null = data;
  return <>
    <div className="panel-scrim" onClick={onClose} aria-hidden/>
    <aside className="side-panel" role="dialog" aria-modal="true" aria-label={c?.name ?? "Customer"}>
      <div className="side-head">
        <IconButton label="Close" onClick={onClose}><X size={18}/></IconButton>
        {c && can("customer:write") && <div className="row-actions">
          <Button size="sm" icon={<Pencil size={15}/>} onClick={() => setEditing(true)}>Edit</Button>
          <Button size="sm" variant="ghost" icon={<Archive size={15}/>} onClick={() => setArchiving(true)}>Archive</Button>
        </div>}
      </div>
      {loading && !c && <Skeleton rows={6}/>}
      {error && <ErrorState message={error} onRetry={reload}/>}
      {c && <div className="side-body">
        <div className="profile">
          <Avatar name={c.name} size={52}/>
          <div><h2>{c.name}</h2><p>{c.company ?? "No company"}</p><Badge tone={statusTone[c.status]}>{label(CUSTOMER_STATUSES, c.status)}</Badge></div>
        </div>
        <dl className="details">
          <div><dt><Mail size={14}/> Email</dt><dd>{c.email ? <a href={"mailto:" + c.email}>{c.email}</a> : "—"}</dd></div>
          <div><dt><Phone size={14}/> Phone</dt><dd>{c.phone ? <a href={"tel:" + c.phone.replace(/\s/g, "")}>{c.phone}</a> : "—"}</dd></div>
          <div><dt>Customer since</dt><dd>{formatDate(c.createdAt)}</dd></div>
        </dl>
        <section className="side-section">
          <h3>Projects <span className="count">{c.projects.length}</span></h3>
          {c.projects.length === 0 ? <p className="muted small">No projects linked yet.</p> :
            <ul className="mini-list">{c.projects.map((p) => <li key={p.id}><Link to={"/projects/" + p.id}><span className="grow">{p.name}</span><Badge tone={p.status}>{label(PROJECT_STATUSES, p.status)}</Badge></Link></li>)}</ul>}
        </section>
        <section className="side-section">
          <h3>Notes <span className="count">{c.notes.length}</span></h3>
          {can("note:write") && <form className="note-form" onSubmit={addNote}>
            <textarea rows={3} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log a call, a decision or a preference…" aria-label="New note"/>
            <Button variant="primary" size="sm" type="submit" busy={saving} disabled={!note.trim()}>Add note</Button>
          </form>}
          {c.notes.length === 0 ? <p className="muted small">No notes yet.</p> : <ul className="notes">{c.notes.map((n) => <li key={n.id}>
            <div className="note-meta"><Avatar name={n.authorName} size={22}/><strong>{n.authorName ?? "Former member"}</strong><span>{relativeTime(n.createdAt)}</span>
              {(n.authorId === user.id || can("customer:write")) && <IconButton label="Delete note" className="sm" onClick={() => void deleteNote(n.id)}><Trash2 size={14}/></IconButton>}
            </div>
            <p>{n.body}</p>
          </li>)}</ul>}
        </section>
      </div>}
    </aside>
    {editing && c && <CustomerForm customer={c} onClose={() => setEditing(false)} onSaved={(updated) => { setEditing(false); setData((d) => d ? { ...d, ...updated } : d); onChanged(); }}/>}
    {archiving && c && <ConfirmDialog title={"Archive " + c.name + "?"} message="The customer leaves your active list. You can restore it from the Archived view." confirmLabel="Archive" busy={busy} onCancel={() => setArchiving(false)} onConfirm={() => void archive()}/>}
  </>;
}

export default function CustomersPage() {
  const { can, notify, bumpData, dataVersion } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [status, setStatus] = useState<"" | CustomerStatus>("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);
  const openId = params.get("open");

  useEffect(() => { const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 250); return () => window.clearTimeout(t); }, [searchInput]);
  const { data, error, loading, reload } = useAsync((signal) => api.customers({ search, page, pageSize: 12, archived: view === "archived", status }, signal), [search, page, view, status, version, dataVersion]);
  const refresh = () => { setVersion((v) => v + 1); bumpData(); };

  async function restore(c: Customer) {
    try { await api.restoreCustomer(c.id); notify(c.name + " restored"); refresh(); }
    catch (reason) { notify(errorMessage(reason), "error"); }
  }

  const pagination = data?.pagination;
  return <div className="stack">
    <PageHeader eyebrow="Customers" title="Customers" description="Contacts, notes and the projects you run for each customer."
      actions={<>
        {can("data:export") && <a className="btn btn-secondary" href={api.exportUrl("customers")} download><Download size={16}/><span>Export CSV</span></a>}
        {can("customer:write") && <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setCreating(true)}>Add customer</Button>}
      </>}/>
    <div className="toolbar card">
      <label className="search-field"><Search size={16} aria-hidden/><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, email or company" aria-label="Search customers"/>{searchInput && <IconButton label="Clear search" className="sm" onClick={() => setSearchInput("")}><X size={14}/></IconButton>}</label>
      <select className="select-sm" value={status} onChange={(e) => { setStatus(e.target.value as CustomerStatus | ""); setPage(1); }} aria-label="Filter by status">
        <option value="">All statuses</option>{CUSTOMER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <Segmented label="Customer list" value={view} onChange={(v) => { setView(v); setPage(1); }} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]}/>
    </div>
    {error && <ErrorState message={error} onRetry={reload}/>}
    <section className="card flush">
      {loading && !data ? <div className="pad"><Skeleton rows={6}/></div> : data && data.data.length === 0 ? (
        <EmptyState icon={<Users size={20}/>} title={search || status ? "No matching customers" : view === "archived" ? "No archived customers" : "No customers yet"}
          action={!search && !status && view === "active" && can("customer:write") && <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setCreating(true)}>Add your first customer</Button>}>
          {search || status ? "Try a different search or filter." : view === "archived" ? "Archived customers will appear here." : "Add the people and companies you work with."}
        </EmptyState>
      ) : data && <>
        <div className="table" role="table" aria-label="Customers">
          <div className="table-head" role="row"><span role="columnheader">Customer</span><span role="columnheader">Company</span><span role="columnheader">Status</span><span role="columnheader">Projects</span><span role="columnheader" className="sr-only">Actions</span></div>
          {data.data.map((c) => <div key={c.id} role="row" className="table-row">
            <button type="button" role="cell" className="cell-main" onClick={() => view === "active" && setParams({ open: c.id })} disabled={view === "archived"}>
              <Avatar name={c.name} size={34}/><span><strong>{c.name}</strong><small>{c.email ?? "No email"}</small></span>
            </button>
            <span role="cell" className="cell-muted">{c.company ?? "—"}</span>
            <span role="cell"><Badge tone={statusTone[c.status]}>{label(CUSTOMER_STATUSES, c.status)}</Badge></span>
            <span role="cell" className="cell-muted">{c.projectCount ?? 0}</span>
            <span role="cell" className="cell-actions">{view === "archived" ? can("customer:write") && <Button size="sm" icon={<RotateCcw size={14}/>} onClick={() => void restore(c)}>Restore</Button>
              : <Button size="sm" variant="ghost" onClick={() => setParams({ open: c.id })}>Open</Button>}</span>
          </div>)}
        </div>
        {pagination && pagination.totalPages > 1 && <div className="pager">
          <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} customers</span>
          <div><IconButton label="Previous page" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={16}/></IconButton><IconButton label="Next page" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={16}/></IconButton></div>
        </div>}
        {loading && <div className="inline-loading"><Spinner label="Updating…"/></div>}
      </>}
    </section>
    {creating && <CustomerForm customer={null} onClose={() => setCreating(false)} onSaved={(c) => { setCreating(false); refresh(); setParams({ open: c.id }); }}/>}
    {openId && <CustomerPanel id={openId} onClose={() => setParams({})} onChanged={refresh}/>}
  </div>;
}
