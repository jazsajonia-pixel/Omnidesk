import { useState, type FormEvent } from "react";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { authClient } from "../lib/auth-client";
import { api } from "../lib/api";
import { ROLES, errorMessage, formatDate, label } from "../lib/format";
import type { ThemeChoice } from "../lib/theme";
import { useWorkspace } from "../lib/workspace";
import { Badge, Button, Field, PageHeader } from "../components/ui";

type Theme = { choice: ThemeChoice; resolved: "light" | "dark"; setChoice: (c: ThemeChoice) => void; toggle: () => void };

export default function SettingsPage({ theme }: { theme: Theme }) {
  const { user, workspace, can, notify, refreshWorkspace } = useWorkspace();
  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [wsName, setWsName] = useState(workspace.name);
  const [savingWs, setSavingWs] = useState(false);

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setSavingName(true);
    try {
      const r = await authClient.updateUser({ name: name.trim() });
      if (r.error) throw new Error(r.error.message ?? "Couldn't update your name.");
      notify("Profile updated");
      await refreshWorkspace();
    } catch (reason) { notify(errorMessage(reason), "error"); }
    finally { setSavingName(false); }
  }
  async function saveWorkspace(event: FormEvent) {
    event.preventDefault();
    setSavingWs(true);
    try { await api.renameWorkspace(wsName.trim()); notify("Workspace renamed"); await refreshWorkspace(); }
    catch (reason) { notify(errorMessage(reason), "error"); }
    finally { setSavingWs(false); }
  }
  const themes: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [{ value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }, { value: "system", label: "System", icon: Monitor }];

  return <div className="stack narrow">
    <PageHeader eyebrow="Settings" title="Settings" description="Your profile, appearance and workspace."/>
    <section className="card">
      <div className="card-head"><div><h2>Profile</h2><p>Signed in as {user.email}</p></div></div>
      <form className="inline-form" onSubmit={saveName}>
        <Field label="Display name"><input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} disabled={workspace.isDemo}/></Field>
        <Button variant="primary" type="submit" busy={savingName} disabled={workspace.isDemo || !name.trim() || name.trim() === user.name}>Save</Button>
      </form>
    </section>
    <section className="card">
      <div className="card-head"><div><h2>Appearance</h2><p>Choose a theme, or follow your device setting.</p></div></div>
      <div className="theme-options" role="radiogroup" aria-label="Theme">
        {themes.map((t) => <button key={t.value} type="button" role="radio" aria-checked={theme.choice === t.value} className={"theme-option" + (theme.choice === t.value ? " selected" : "")} onClick={() => theme.setChoice(t.value)}>
          <span className={"theme-swatch swatch-" + t.value}/><span><t.icon size={15}/> {t.label}</span>
        </button>)}
      </div>
    </section>
    <section className="card">
      <div className="card-head"><div><h2>Workspace</h2><p>Created {formatDate(workspace.createdAt)} · {workspace.memberCount} member{workspace.memberCount === 1 ? "" : "s"} · your role <Badge tone="accent">{label(ROLES, workspace.role)}</Badge></p></div></div>
      {can("workspace:manage") ? <form className="inline-form" onSubmit={saveWorkspace}>
        <Field label="Workspace name"><input required maxLength={80} value={wsName} onChange={(e) => setWsName(e.target.value)}/></Field>
        <Button variant="primary" type="submit" busy={savingWs} disabled={!wsName.trim() || wsName.trim() === workspace.name}>Rename</Button>
      </form> : <p className="muted small">Only admins and owners can rename the workspace.</p>}
    </section>
    <section className="card">
      <div className="card-head"><div><h2>Session</h2><p>Sign out of OmniDesk on this device.</p></div></div>
      <Button icon={<LogOut size={16}/>} onClick={() => void authClient.signOut().then(() => window.location.assign("/"))}>Sign out</Button>
    </section>
  </div>;
}
