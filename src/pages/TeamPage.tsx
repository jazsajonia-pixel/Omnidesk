import { useState, type FormEvent } from "react";
import { Check, Copy, MailPlus, ShieldCheck, Trash2, UserMinus } from "lucide-react";
import { api, type Member, type Role } from "../lib/api";
import { ROLES, errorMessage, formatDate, label } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useWorkspace } from "../lib/workspace";
import { Avatar, Badge, Button, ConfirmDialog, ErrorState, Field, IconButton, PageHeader, Skeleton } from "../components/ui";

const RANK: Record<Role, number> = { viewer: 0, member: 1, manager: 2, admin: 3, owner: 4 };
function canManageRole(actor: Role, target: Role) {
  if (actor === "owner") return true;
  if (actor === "admin") return target !== "owner" && target !== "admin";
  return false;
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="copy-link"><input readOnly value={url} aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()}/>
    <Button size="sm" icon={copied ? <Check size={14}/> : <Copy size={14}/>} onClick={() => void navigator.clipboard.writeText(url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); })}>{copied ? "Copied" : "Copy"}</Button></div>;
}

export default function TeamPage() {
  const { can, notify, user, workspace, refreshWorkspace, bumpData } = useWorkspace();
  const { data, error, loading, reload, setData } = useAsync((signal) => api.team(signal).then((r) => r.data), []);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [lastLink, setLastLink] = useState<{ email: string; url: string } | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const manage = can("team:manage");
  const myRole = (data?.me.role ?? workspace.role) as Role;
  const assignable = ROLES.filter((r) => canManageRole(myRole, r.value));
  const linkFor = (id: string) => window.location.origin + "/invite/" + id;

  async function invite(event: FormEvent) {
    event.preventDefault();
    setInviting(true);
    setInviteError("");
    try {
      const r = await api.invite(email.trim(), role);
      setData((d) => d ? { ...d, invitations: [r.data, ...d.invitations] } : d);
      setLastLink({ email: r.data.email, url: linkFor(r.data.id) });
      setEmail("");
      notify("Invitation created");
    } catch (reason) { setInviteError(errorMessage(reason)); }
    finally { setInviting(false); }
  }
  async function changeRole(m: Member, next: Role) {
    try {
      await api.changeRole(m.id, next);
      setData((d) => d ? { ...d, members: d.members.map((x) => x.id === m.id ? { ...x, role: next } : x) } : d);
      notify(m.name + " is now " + label(ROLES, next).toLowerCase());
      if (m.userId === user.id) await refreshWorkspace();
    } catch (reason) { notify(errorMessage(reason), "error"); }
  }
  async function cancelInvite(id: string) {
    try { await api.cancelInvite(id); setData((d) => d ? { ...d, invitations: d.invitations.filter((i) => i.id !== id) } : d); notify("Invitation cancelled"); }
    catch (reason) { notify(errorMessage(reason), "error"); }
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      const r = await api.removeMember(removing.id);
      if (r.data.left) { window.location.assign("/"); return; }
      setData((d) => d ? { ...d, members: d.members.filter((x) => x.id !== removing.id) } : d);
      notify(removing.name + " was removed");
      bumpData();
      setRemoving(null);
    } catch (reason) { notify(errorMessage(reason), "error"); }
    finally { setBusy(false); }
  }

  const leaving = removing?.userId === user.id;
  return <div className="stack">
    <PageHeader eyebrow="Team" title="Team" description={"People with access to " + workspace.name + "."}/>
    {error && <ErrorState message={error} onRetry={reload}/>}
    {manage && <section className="card">
      <div className="card-head"><div><h2>Invite a teammate</h2><p>Create an invitation and share the link. It's valid for 7 days and only works for that email address.</p></div></div>
      {workspace.isDemo ? <p className="muted small">Invitations are disabled in demo workspaces.</p> :
        <form className="invite-form" onSubmit={invite}>
          <Field label="Email"><input type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com"/></Field>
          <Field label="Role"><select value={role} onChange={(e) => setRole(e.target.value as Role)}>{assignable.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
          <Button variant="primary" type="submit" busy={inviting} icon={<MailPlus size={16}/>}>Create invite</Button>
        </form>}
      {!workspace.isDemo && <p className="field-hint">{label(ROLES, role)}: {ROLES.find((r) => r.value === role)?.description}</p>}
      {inviteError && <div className="alert alert-error" role="alert">{inviteError}</div>}
      {lastLink && <div className="alert alert-success"><strong>Share this link with {lastLink.email}:</strong><CopyLink url={lastLink.url}/></div>}
    </section>}
    <section className="card flush">
      <div className="card-head pad"><div><h2>Members <span className="count">{data?.members.length ?? ""}</span></h2></div></div>
      {loading && !data ? <div className="pad"><Skeleton rows={4}/></div> : data && <ul className="list members">
        {[...data.members].sort((a, b) => RANK[b.role] - RANK[a.role] || a.name.localeCompare(b.name)).map((m) => {
          const self = m.userId === user.id;
          const editable = manage && !self && canManageRole(myRole, m.role);
          return <li key={m.id} className="list-row member-row">
            <Avatar name={m.name} size={36}/>
            <span className="grow"><strong>{m.name}{self && <span className="you"> (you)</span>}</strong><small>{m.email} · joined {formatDate(m.joinedAt)}</small></span>
            {editable ? <select className="select-sm" value={m.role} onChange={(e) => void changeRole(m, e.target.value as Role)} aria-label={"Role for " + m.name}>
              {ROLES.filter((r) => canManageRole(myRole, r.value)).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select> : <Badge tone={m.role === "owner" ? "accent" : "default"}>{m.role === "owner" && <ShieldCheck size={12}/>} {label(ROLES, m.role)}</Badge>}
            {(editable || self) && !workspace.isDemo && <IconButton label={self ? "Leave workspace" : "Remove " + m.name} onClick={() => setRemoving(m)}>{self ? <UserMinus size={16}/> : <Trash2 size={16}/>}</IconButton>}
          </li>;
        })}
      </ul>}
    </section>
    {manage && data && data.invitations.length > 0 && <section className="card flush">
      <div className="card-head pad"><div><h2>Pending invitations <span className="count">{data.invitations.length}</span></h2></div></div>
      <ul className="list">{data.invitations.map((inv) => <li key={inv.id} className="list-row invite-row">
        <span className="grow"><strong>{inv.email}</strong><small>{label(ROLES, inv.role)} · expires {formatDate(inv.expiresAt)}</small></span>
        <CopyLink url={linkFor(inv.id)}/>
        <Button size="sm" variant="ghost" className="danger-text" onClick={() => void cancelInvite(inv.id)}>Cancel</Button>
      </li>)}</ul>
    </section>}
    <section className="card">
      <div className="card-head"><div><h2>Roles</h2><p>What each role can do in this workspace</p></div></div>
      <ul className="role-list">{ROLES.map((r) => <li key={r.value}><Badge tone={r.value === myRole ? "accent" : "default"}>{r.label}</Badge><span>{r.description}</span></li>)}</ul>
    </section>
    {removing && <ConfirmDialog title={leaving ? "Leave " + workspace.name + "?" : "Remove " + removing.name + "?"} message={leaving ? "You'll lose access until someone invites you again." : "They'll lose access immediately. Their past activity stays in the history."} confirmLabel={leaving ? "Leave workspace" : "Remove member"} busy={busy} onCancel={() => setRemoving(null)} onConfirm={() => void remove()}/>}
  </div>;
}
