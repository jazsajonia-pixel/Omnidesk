import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BarChart3, Building2, CheckSquare, LoaderCircle, LogIn, ShieldCheck, Sparkles, Users } from "lucide-react";
import App from "./App";
import { authClient } from "./lib/auth-client";
import { api, type Workspace } from "./lib/api";
import { errorMessage } from "./lib/format";
import { WorkspaceProvider } from "./lib/workspace";
import { Logo } from "./components/Logo";
import { useTheme } from "./lib/theme";

type Organization = { id: string; name: string; slug: string };
const PENDING_INVITE = "omnidesk-pending-invite";

function rememberInvite() {
  const match = /^\/invite\/([\w-]+)/.exec(window.location.pathname);
  if (match) sessionStorage.setItem(PENDING_INVITE, match[1]);
}

function AuthShell({ children }: { children: React.ReactNode }) {
  useTheme();
  return <main className="auth-shell">
    <section className="auth-side" aria-hidden>
      <div className="auth-side-inner">
        <div className="auth-brand"><Logo size={38}/><span className="brand-text">omni<span>desk</span></span></div>
        <h2>Customers, projects and tasks in one calm workspace.</h2>
        <ul>
          <li><Users size={17}/> Customer records with notes and linked projects</li>
          <li><CheckSquare size={17}/> Drag-and-drop task board with owners and due dates</li>
          <li><BarChart3 size={17}/> Live reports and a full activity history</li>
          <li><ShieldCheck size={17}/> Role-based access, private to each workspace</li>
        </ul>
      </div>
    </section>
    <section className="auth-main">{children}</section>
  </main>;
}

function DemoButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setBusy(true);
    setError("");
    try {
      await api.startDemo();
      window.location.assign("/");
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't start the demo. Try again."));
      setBusy(false);
    }
  }
  return <div className="demo-cta">
    <button type="button" className="btn btn-accent-soft btn-block" onClick={() => void start()} disabled={busy}>
      {busy ? <LoaderCircle size={17} className="spin"/> : <Sparkles size={17}/>}<span>{busy ? "Preparing your demo workspace…" : "Explore the live demo"}</span>{!busy && <ArrowRight size={16}/>}
    </button>
    <small>No sign-up needed. You get a private workspace with sample data for 24 hours.</small>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
  </div>;
}

function AuthForm({ onChanged }: { onChanged: () => Promise<unknown> }) {
  const [mode, setMode] = useState<"signin" | "signup">(window.location.pathname.startsWith("/invite/") ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const invited = Boolean(sessionStorage.getItem(PENDING_INVITE));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = mode === "signup"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.status === 429 ? "Too many attempts. Wait a minute and try again." : result.error.message || "We couldn't sign you in. Check your details and try again.");
        return;
      }
      await onChanged();
    } catch {
      setError("The sign-in service couldn't be reached. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  return <AuthShell>
    <div className="auth-card">
      <div className="auth-brand mobile-only"><Logo size={34}/><span className="brand-text">omni<span>desk</span></span></div>
      <h1>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
      <p className="auth-subtitle">{invited ? "Sign in or create an account with the email address your invitation was sent to." : mode === "signin" ? "Sign in to continue to your workspace." : "Start with a secure account, then set up your workspace."}</p>
      {!invited && <><DemoButton/><div className="divider"><span>or use your account</span></div></>}
      <form className="form-grid" onSubmit={submit}>
        {mode === "signup" && <label className="field"><span className="field-label">Your name</span><input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Alex Morgan"/></label>}
        <label className="field"><span className="field-label">Email address</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} placeholder="you@company.com"/></label>
        <label className="field"><span className="field-label">Password</span><input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={128} placeholder="At least 8 characters"/></label>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17}/> : <LogIn size={17}/>}<span>{busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}</span>
        </button>
      </form>
      <div className="auth-switch">
        <span>{mode === "signin" ? "New to OmniDesk?" : "Already have an account?"}</span>
        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>{mode === "signin" ? "Create an account" : "Sign in"}</button>
      </div>
      <p className="auth-footnote"><ShieldCheck size={13}/> Your data is private to the workspaces you belong to.</p>
    </div>
  </AuthShell>;
}

function WorkspaceSetup({ onChanged, userName }: { onChanged: () => Promise<unknown>; userName: string }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    authClient.organization.list().then((result) => {
      if (!alive) return;
      if (result.error) setError(result.error.message || "Couldn't load your workspaces.");
      else setOrganizations((result.data ?? []) as Organization[]);
    }).catch(() => { if (alive) setError("Couldn't load your workspaces. Check your connection and try again."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function updateName(value: string) {
    setName(value);
    setSlug(value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48));
  }

  async function activate(organizationId: string) {
    setBusy(true);
    setError("");
    const result = await authClient.organization.setActive({ organizationId }).catch(() => null);
    if (!result || result.error) { setError(result?.error?.message || "Couldn't open this workspace."); setBusy(false); return; }
    await onChanged();
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await authClient.organization.create({ name: name.trim(), slug: slug.trim() });
      if (result.error || !result.data) { setError(result.error?.message || "Couldn't create the workspace. Try a different address."); setBusy(false); return; }
      await activate(result.data.id);
    } catch { setError("Couldn't create the workspace. Try again."); setBusy(false); }
  }

  return <AuthShell>
    <div className="auth-card">
      <div className="auth-kicker"><Building2 size={15}/> Workspace setup</div>
      <h1>Good to see you, {userName.split(" ")[0] || "there"}.</h1>
      <p className="auth-subtitle">Choose a workspace or create one for your team. Records stay separate between workspaces.</p>
      {loading ? <div className="loading-row"><LoaderCircle className="spin" size={18}/> Loading your workspaces…</div> : <>
        {organizations.length > 0 && <div className="org-list">{organizations.map((org) => <button className="org-option" key={org.id} type="button" disabled={busy} onClick={() => void activate(org.id)}>
          <span className="ws-avatar">{org.name.slice(0, 1).toUpperCase()}</span><span className="grow"><strong>{org.name}</strong><small>{org.slug}</small></span><ArrowRight size={16}/>
        </button>)}</div>}
        <div className="divider"><span>{organizations.length ? "Or create a new workspace" : "Create your first workspace"}</span></div>
        <form className="form-grid" onSubmit={createWorkspace}>
          <label className="field"><span className="field-label">Workspace name</span><input value={name} onChange={(e) => updateName(e.target.value)} required minLength={2} maxLength={100} placeholder="Acme Studio"/></label>
          <label className="field"><span className="field-label">Workspace address</span><input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-"))} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" minLength={2} maxLength={48} placeholder="acme-studio"/><small className="field-hint">Lowercase letters, numbers and dashes.</small></label>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Building2 size={17}/>}<span>{busy ? "Setting up…" : "Create workspace"}</span></button>
        </form>
      </>}
      <button className="link-button center" type="button" onClick={() => void authClient.signOut().then(() => onChanged())}>Sign out</button>
    </div>
  </AuthShell>;
}

type SessionData = NonNullable<ReturnType<typeof authClient.useSession>["data"]>;

function AuthenticatedApp({ sessionData, onChanged }: { sessionData: SessionData; onChanged: () => Promise<unknown> }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await api.workspace();
      setWorkspace(result.data);
      setError("");
    } catch (reason) {
      const status = (reason as { status?: number }).status;
      if (status === 403) { await authClient.organization.setActive({ organizationId: null }); await onChanged(); return; }
      setError(errorMessage(reason, "Couldn't load your workspace."));
    }
  }, [onChanged]);
  useEffect(() => { void load(); }, [load, sessionData.session.activeOrganizationId]);
  if (error) return <AuthShell><div className="auth-card"><h1>Something went wrong</h1><p className="auth-subtitle">{error}</p><button className="btn btn-primary btn-block" type="button" onClick={() => void load()}>Try again</button><button className="link-button center" type="button" onClick={() => void authClient.signOut().then(() => onChanged())}>Sign out</button></div></AuthShell>;
  if (!workspace) return <main className="boot"><Logo size={44}/><div className="loading-row"><LoaderCircle className="spin" size={18}/> Opening your workspace…</div></main>;
  return <WorkspaceProvider workspace={workspace} user={{ id: sessionData.user.id, name: sessionData.user.name, email: sessionData.user.email }} refreshWorkspace={load}>
    <App/>
  </WorkspaceProvider>;
}

export default function AuthGate() {
  const { data: sessionData, isPending, refetch } = authClient.useSession();
  const onChanged = useCallback(async () => { await refetch(); }, [refetch]);
  useEffect(rememberInvite, []);
  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_INVITE);
    if (sessionData && pending && !window.location.pathname.startsWith("/invite/")) window.history.replaceState(null, "", "/invite/" + pending);
  }, [sessionData]);
  if (isPending) return <main className="boot"><Logo size={44}/><div className="loading-row"><LoaderCircle className="spin" size={18}/> Checking your session…</div></main>;
  if (!sessionData) return <AuthForm onChanged={onChanged}/>;
  if (window.location.pathname.startsWith("/invite/") && !sessionData.session.activeOrganizationId) {
    return <InviteStandalone onChanged={onChanged}/>;
  }
  if (!sessionData.session.activeOrganizationId) return <WorkspaceSetup onChanged={onChanged} userName={sessionData.user.name}/>;
  return <AuthenticatedApp sessionData={sessionData} onChanged={onChanged}/>;
}

function InviteStandalone({ onChanged }: { onChanged: () => Promise<unknown> }) {
  const id = window.location.pathname.split("/")[2] ?? "";
  const [state, setState] = useState<{ loading: boolean; error: string; info?: Awaited<ReturnType<typeof api.invitation>>["data"] }>({ loading: true, error: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.invitation(id).then((r) => setState({ loading: false, error: "", info: r.data })).catch((e) => setState({ loading: false, error: errorMessage(e) }));
  }, [id]);
  async function accept() {
    setBusy(true);
    try {
      const result = await api.acceptInvitation(id);
      sessionStorage.removeItem(PENDING_INVITE);
      await authClient.organization.setActive({ organizationId: result.data.organizationId });
      window.location.assign("/");
    } catch (e) { setState((s) => ({ ...s, error: errorMessage(e) })); setBusy(false); }
  }
  const info = state.info;
  return <AuthShell><div className="auth-card">
    <div className="auth-kicker"><Users size={15}/> Workspace invitation</div>
    {state.loading ? <div className="loading-row"><LoaderCircle className="spin" size={18}/> Loading invitation…</div> : <>
      <h1>{info ? "Join " + info.organizationName : "Invitation unavailable"}</h1>
      {info && <p className="auth-subtitle">{info.inviterName ?? "A teammate"} invited <strong>{info.email}</strong> to join as <strong>{info.role}</strong>.</p>}
      {state.error && <div className="alert alert-error" role="alert">{state.error}</div>}
      {info && !info.emailMatches && <div className="alert alert-warning">You're signed in with a different email. Sign out and use the invited address.</div>}
      {info && (info.expired || info.status !== "pending") && <div className="alert alert-warning">This invitation is {info.expired ? "expired" : info.status}. Ask for a new one.</div>}
      {info && info.emailMatches && !info.expired && info.status === "pending" && <button className="btn btn-primary btn-block btn-lg" type="button" disabled={busy} onClick={() => void accept()}>{busy ? <LoaderCircle className="spin" size={17}/> : <ArrowRight size={17}/>}<span>Accept and open workspace</span></button>}
    </>}
    <button className="link-button center" type="button" onClick={() => { sessionStorage.removeItem(PENDING_INVITE); void authClient.signOut().then(() => { window.history.replaceState(null, "", "/"); return onChanged(); }); }}>Sign out</button>
  </div></AuthShell>;
}
