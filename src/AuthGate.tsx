import { useEffect, useState, type FormEvent } from "react";
import { Building2, Command, LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import App from "./App";
import { authClient } from "./lib/auth-client";

type Organization = { id: string; name: string; slug: string };

function AuthForm({ onChanged }: { onChanged: () => Promise<unknown> }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = mode === "signup"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message || "We couldn't sign you in. Check your details and try again.");
        return;
      }
      await onChanged();
      setMessage(mode === "signup" ? "Your account is ready. If you're not moved forward automatically, sign in below." : "Signed in. Loading your workspace…");
      if (mode === "signup") setMode("signin");
    } catch {
      setError("The authentication service could not be reached. Check the server configuration and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-shell">
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-brand"><span className="brand-mark"><Command size={22}/></span><div><strong>omni<span>desk</span></strong><small>OPERATIONS WORKSPACE</small></div></div>
      <div className="auth-kicker"><ShieldCheck size={15}/> A clearer way to work</div>
      <h1 id="auth-title">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
      <p className="auth-subtitle">{mode === "signin" ? "Sign in to continue to your workspace." : "Start with a secure account, then set up your workspace."}</p>
      <form className="auth-form" onSubmit={submit}>
        {mode === "signup" && <label>Your name<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Alex Morgan"/></label>}
        <label>Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} placeholder="you@company.com"/></label>
        <label>Password<input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={128} placeholder="At least 8 characters"/></label>
        {error && <div className="auth-message error" role="alert">{error}</div>}
        {message && <div className="auth-message success" role="status">{message}</div>}
        <button className="auth-primary" type="submit" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17}/> : <LogIn size={17}/>}
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      <div className="auth-switch">
        <span>{mode === "signin" ? "New to OmniDesk?" : "Already have an account?"}</span>
        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}>
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </div>
      <p className="auth-footnote">Your workspace data is private to the organization you select.</p>
    </section>
  </main>;
}

function WorkspaceSetup({ onChanged, userName }: { onChanged: () => Promise<unknown>; userName: string }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    authClient.organization.list().then((result) => {
      if (!alive) return;
      if (result.error) setError(result.error.message || "Couldn't load your workspaces. Try again.");
      else setOrganizations((result.data ?? []) as Organization[]);
    }).catch(() => {
      if (alive) setError("Couldn't load your workspaces. Check the API configuration and try again.");
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function updateName(value: string) {
    setName(value);
    setSlug(value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48));
  }

  async function activate(organizationId: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await authClient.organization.setActive({ organizationId });
      if (result.error) {
        setError(result.error.message || "Couldn't open this workspace. Try again.");
        return;
      }
      await onChanged();
    } catch {
      setError("Couldn't open this workspace. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await authClient.organization.create({ name: name.trim(), slug: slug.trim() });
      if (result.error || !result.data) {
        setError(result.error?.message || "Couldn't create the workspace. Try a different workspace address.");
        return;
      }
      const active = await authClient.organization.setActive({ organizationId: result.data.id });
      if (active.error) {
        setError(active.error.message || "Workspace created, but it couldn't be opened. Choose it from the list.");
        setOrganizations((current) => [...current, result.data as Organization]);
        return;
      }
      setMessage("Workspace created. Loading your dashboard…");
      await onChanged();
    } catch {
      setError("Couldn't create the workspace. Check the API configuration and try again.");
    } finally { setBusy(false); }
  }

  return <main className="auth-shell">
    <section className="auth-card workspace-card" aria-labelledby="workspace-title">
      <div className="auth-brand"><span className="brand-mark"><Command size={22}/></span><div><strong>omni<span>desk</span></strong><small>OPERATIONS WORKSPACE</small></div></div>
      <div className="auth-kicker"><Building2 size={15}/> Workspace setup</div>
      <h1 id="workspace-title">Good to see you, {userName.split(" ")[0] || "there"}.</h1>
      <p className="auth-subtitle">Choose a workspace or create one for your team. Your records stay separate from other organizations.</p>
      {loading ? <div className="auth-loading"><LoaderCircle className="spin" size={20}/> Loading your workspaces…</div> : <>
        {organizations.length > 0 && <div className="organization-list"><h2>Your workspaces</h2>{organizations.map((organization) => <button className="organization-option" key={organization.id} type="button" disabled={busy} onClick={() => void activate(organization.id)}><span className="org-avatar">{organization.name.slice(0, 1).toUpperCase()}</span><span className="org-copy"><strong>{organization.name}</strong><small>{organization.slug}</small></span><span className="org-arrow">›</span></button>)}</div>}
        <div className="workspace-divider"><span>{organizations.length ? "Or create a new workspace" : "Create your first workspace"}</span></div>
        <form className="auth-form" onSubmit={createWorkspace}>
          <label>Workspace name<input value={name} onChange={(e) => updateName(e.target.value)} required minLength={2} maxLength={100} placeholder="Acme Studio"/></label>
          <label>Workspace address<input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-"))} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" minLength={2} maxLength={48} placeholder="acme-studio"/><small className="field-hint">A short unique address for this workspace.</small></label>
          {error && <div className="auth-message error" role="alert">{error}</div>}
          {message && <div className="auth-message success" role="status">{message}</div>}
          <button className="auth-primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Building2 size={17}/>} {busy ? "Setting up…" : "Create workspace"}</button>
        </form>
      </>}
      {!loading && error && organizations.length === 0 && <button className="auth-secondary" type="button" onClick={() => window.location.reload()}>Try loading again</button>}
      <button className="auth-signout" type="button" onClick={() => void authClient.signOut().then(() => onChanged())}>Sign out</button>
    </section>
  </main>;
}

type AuthSessionData = NonNullable<ReturnType<typeof authClient.useSession>["data"]>;

function AuthenticatedApp({ sessionData }: { sessionData: AuthSessionData }) {
  const [workspaceName, setWorkspaceName] = useState("Active workspace");
  const activeOrganizationId = sessionData.session.activeOrganizationId;

  useEffect(() => {
    let alive = true;
    authClient.organization.list().then((result) => {
      if (!alive || !result.data) return;
      const active = result.data.find((organization) => organization.id === activeOrganizationId);
      if (active) setWorkspaceName(active.name);
    }).catch(() => {
      if (alive) setWorkspaceName("Active workspace");
    });
    return () => { alive = false; };
  }, [activeOrganizationId]);

  return <App workspaceName={workspaceName} userName={sessionData.user.name}/>;
}

export default function AuthGate() {
  const { data: sessionData, isPending, refetch } = authClient.useSession();
  if (isPending) return <main className="auth-shell"><div className="auth-loading"><LoaderCircle className="spin" size={22}/> Checking your session…</div></main>;
  if (!sessionData) return <AuthForm onChanged={refetch}/>;
  if (!sessionData.session.activeOrganizationId) {
    return <WorkspaceSetup onChanged={refetch} userName={sessionData.user.name}/>;
  }
  return <AuthenticatedApp sessionData={sessionData}/>;
}
