import { useEffect, useState, type FormEvent } from "react";
import { Archive, ArrowLeft, ArrowRight, Building2, Check, ChevronLeft, ChevronRight, LoaderCircle, Pencil, Plus, RotateCcw, Search, Users, X } from "lucide-react";
import {
  archiveCustomer, createCustomer, listCustomers, restoreCustomer, updateCustomer,
  type Customer, type CustomerInput,
} from "../lib/api";

const PAGE_SIZE = 10;

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function CustomerDialog({ customer, onClose, onSave }: {
  customer: Customer | null; onClose: () => void; onSave: (input: CustomerInput) => Promise<void>;
}) {
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [company, setCompany] = useState(customer?.company ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({ name: name.trim(), email: email.trim(), company: company.trim() });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this customer. Try again.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === "Escape" && !busy) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return <div className="customer-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="customer-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-dialog-title">
      <div className="customer-dialog-heading"><div><span className="customer-dialog-icon"><Users size={18}/></span><h2 id="customer-dialog-title">{customer ? "Edit customer" : "Add a customer"}</h2><p>Keep the contact details your team needs.</p></div><button className="icon-button" type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={18}/></button></div>
      <form className="customer-form" onSubmit={submit}>
        <label>Customer name<input autoFocus required minLength={1} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="Jordan Lee"/></label>
        <label>Email address <span className="optional-label">Optional</span><input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="jordan@company.com"/></label>
        <label>Company <span className="optional-label">Optional</span><input maxLength={160} value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name"/></label>
        {error && <div className="customer-alert error" role="alert">{error}</div>}
        <div className="customer-dialog-actions"><button className="customer-button secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="customer-button primary" type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>} {busy ? "Saving…" : customer ? "Save changes" : "Add customer"}</button></div>
      </form>
    </section>
  </div>;
}

function ArchiveDialog({ customer, busy, error, onCancel, onConfirm }: {
  customer: Customer; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void;
}) {
  return <div className="customer-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="customer-dialog confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-title">
      <div className="customer-dialog-heading"><div><span className="customer-dialog-icon warning"><Archive size={18}/></span><h2 id="archive-title">Archive {customer.name}?</h2><p>The record will leave your active list. You can restore it later.</p></div><button className="icon-button" type="button" aria-label="Close dialog" disabled={busy} onClick={onCancel}><X size={18}/></button></div>
      {error && <div className="customer-alert error" role="alert">{error}</div>}
      <div className="customer-dialog-actions"><button className="customer-button secondary" type="button" disabled={busy} onClick={onCancel}>Keep customer</button><button className="customer-button danger" type="button" disabled={busy} onClick={onConfirm}>{busy ? <LoaderCircle size={16} className="spin"/> : <Archive size={16}/>} {busy ? "Archiving…" : "Archive customer"}</button></div>
    </section>
  </div>;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = window.setTimeout(() => {
      listCustomers({ search, page, pageSize: PAGE_SIZE, archived, signal: controller.signal })
        .then((result) => {
          setCustomers(result.data);
          setPageInfo(result.pagination);
          if (result.pagination.page !== page) setPage(result.pagination.page);
        }).catch((reason) => {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load customers. Try again.");
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, search ? 220 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search, page, archived, refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function save(input: CustomerInput) {
    if (editing) await updateCustomer(editing.id, input);
    else await createCustomer(input);
    setCreating(false);
    setEditing(null);
    setNotice(editing ? "Customer changes saved." : "Customer added.");
    setPage(1);
    setRefresh((value) => value + 1);
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setActionBusy(true);
    setActionError("");
    try {
      await archiveCustomer(archiveTarget.id);
      setArchiveTarget(null);
      setNotice("Customer archived. You can restore it from the archived list.");
      setRefresh((value) => value + 1);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not archive this customer. Try again.");
    } finally { setActionBusy(false); }
  }

  async function restore(customer: Customer) {
    setActionBusy(true);
    setError("");
    try {
      await restoreCustomer(customer.id);
      setNotice("Customer restored to the active list.");
      setPage(1);
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not restore this customer. Try again.");
    } finally { setActionBusy(false); }
  }

  return <div className="stack customer-page">
    <section className="welcome customer-welcome">
      <div><div className="eyebrow">CUSTOMER RELATIONSHIPS</div><h1>Customers</h1><p>Keep customer details organized in one workspace.</p></div>
      <button className="customer-button primary new-customer" type="button" onClick={() => { setEditing(null); setCreating(true); }}><Plus size={17}/> Add customer</button>
    </section>

    <section className="customer-toolbar panel">
      <div className="customer-search"><Search size={17}/><input aria-label="Search customers" placeholder="Search name, email, or company…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}/>{search && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }}><X size={15}/></button>}</div>
      <div className="customer-filters" role="group" aria-label="Customer list filter">
        <button className={!archived ? "filter-button selected" : "filter-button"} type="button" aria-pressed={!archived} onClick={() => { setArchived(false); setPage(1); }}>Active</button>
        <button className={archived ? "filter-button selected" : "filter-button"} type="button" aria-pressed={archived} onClick={() => { setArchived(true); setPage(1); }}>Archived</button>
      </div>
      <span className="customer-total">{pageInfo.total} {pageInfo.total === 1 ? "record" : "records"}</span>
    </section>

    {notice && <div className="customer-alert success" role="status"><Check size={16}/>{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={15}/></button></div>}
    {error && <div className="customer-alert error" role="alert"><span>{error}</span><button className="customer-button secondary" type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button></div>}

    <section className="panel customer-list-panel">
      <div className="customer-list-heading"><div><h2>{archived ? "Archived customers" : "All customers"}</h2><p>{loading ? "Refreshing customer records…" : search ? "Results matching your search." : archived ? "Records archived from the active list." : "Records saved in your active workspace."}</p></div><span className="pill">{loading ? "Loading" : pageInfo.total + " total"}</span></div>
      {loading && customers.length === 0 ? <div className="customer-loading"><LoaderCircle size={20} className="spin"/> Loading customer records…</div>
      : customers.length === 0 ? <div className="empty customer-empty"><div className="empty-icon"><Users size={22}/></div><h3>{search ? "No customers match this search" : archived ? "No archived customers" : "No customers yet"}</h3><p>{search ? "Try another name, email, or company, or clear your search." : archived ? "Archived records will appear here. Active customers stay in your main list." : "Add your first customer to start building your customer list."}</p>{search ? <button className="customer-button secondary" type="button" onClick={() => setSearch("")}>Clear search</button> : !archived && <button className="customer-button primary" type="button" onClick={() => setCreating(true)}><Plus size={16}/> Add your first customer</button>}</div>
      : <div className="customer-list">
        {customers.map((customer) => <article className="customer-row" key={customer.id}>
          <span className="customer-avatar">{customer.name.slice(0, 1).toUpperCase()}</span>
          <div className="customer-main"><strong>{customer.name}</strong><span>{customer.email || "No email provided"}</span></div>
          <div className="customer-company"><small>Company</small><span>{customer.company || "—"}</span></div>
          <div className="customer-date"><small>{archived ? "Archived" : "Added"}</small><span>{dateLabel(archived && customer.archivedAt ? customer.archivedAt : customer.createdAt)}</span></div>
          <div className="customer-row-actions">
            {!archived ? <>
              <button className="icon-button" type="button" aria-label={"Edit " + customer.name} title="Edit customer" onClick={() => { setEditing(customer); setCreating(false); }}><Pencil size={16}/></button>
              <button className="icon-button archive-action" type="button" aria-label={"Archive " + customer.name} title="Archive customer" onClick={() => { setArchiveTarget(customer); setActionError(""); }}><Archive size={16}/></button>
            </> : <button className="customer-button secondary restore-button" type="button" disabled={actionBusy} onClick={() => void restore(customer)}><RotateCcw size={15}/> Restore</button>}
          </div>
        </article>)}
      </div>}
      {pageInfo.totalPages > 1 && <div className="customer-pagination"><span>Page {pageInfo.page} of {pageInfo.totalPages}</span><div><button className="icon-button" type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={17}/></button><button className="icon-button" type="button" aria-label="Next page" disabled={page >= pageInfo.totalPages || loading} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17}/></button></div></div>}
    </section>
    <div className="customer-security-note"><Building2 size={15}/><span>Customer records are private to your active workspace.</span><ArrowRight size={14}/></div>

    {(creating || editing) && <CustomerDialog key={editing?.id ?? "new"} customer={editing} onClose={() => { setCreating(false); setEditing(null); }} onSave={save}/>}
    {archiveTarget && <ArchiveDialog customer={archiveTarget} busy={actionBusy} error={actionError} onCancel={() => setArchiveTarget(null)} onConfirm={() => void confirmArchive()}/>}
  </div>;
}
