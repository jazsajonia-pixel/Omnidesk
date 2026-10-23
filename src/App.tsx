import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  Activity, BarChart3, Bell, BriefcaseBusiness, Check, CheckSquare, ChevronsUpDown, FileText, LayoutDashboard, LogOut, Menu, Moon,
  Plus, Search, Settings2, Sparkles, Sun, Users, UsersRound, X,
} from "lucide-react";
import { authClient } from "./lib/auth-client";
import { api, type ActivityItem } from "./lib/api";
import { errorMessage, relativeTime } from "./lib/format";
import { useTheme } from "./lib/theme";
import { useWorkspace } from "./lib/workspace";
import { Avatar, Button, Field, IconButton, Modal, Spinner } from "./components/ui";
import { CommandPalette } from "./components/CommandPalette";
import { Logo } from "./components/Logo";
import OverviewPage from "./pages/OverviewPage";

const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const DocumentPage = lazy(() => import("./pages/DocumentPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const InvitePage = lazy(() => import("./pages/InvitePage"));

export const NAV = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Customers", path: "/customers", icon: Users },
  { label: "Projects", path: "/projects", icon: BriefcaseBusiness },
  { label: "Tasks", path: "/tasks", icon: CheckSquare },
  { label: "Documents", path: "/documents", icon: FileText },
  { label: "Reports", path: "/reports", icon: BarChart3 },
  { label: "Team", path: "/team", icon: UsersRound },
  { label: "Settings", path: "/settings", icon: Settings2 },
];

type Org = { id: string; name: string; slug: string };

function WorkspaceSwitcher() {
  const { workspace, notify } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    authClient.organization.list().then((r) => setOrgs((r.data ?? []) as Org[])).catch(() => setOrgs([]));
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function switchTo(id: string) {
    if (id === workspace.id) { setOpen(false); return; }
    const result = await authClient.organization.setActive({ organizationId: id });
    if (result.error) { notify(result.error.message || "Couldn't switch workspace.", "error"); return; }
    window.location.assign("/");
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + Math.random().toString(36).slice(2, 6);
    try {
      const result = await authClient.organization.create({ name: name.trim(), slug });
      if (result.error || !result.data) throw new Error(result.error?.message || "Couldn't create the workspace.");
      await authClient.organization.setActive({ organizationId: result.data.id });
      window.location.assign("/");
    } catch (reason) { setError(errorMessage(reason)); setBusy(false); }
  }

  return <div className="switcher" ref={ref}>
    <button type="button" className="switcher-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
      <span className="ws-avatar">{workspace.name.slice(0, 1).toUpperCase()}</span>
      <span className="ws-copy"><strong>{workspace.name}</strong><small>{workspace.memberCount} {workspace.memberCount === 1 ? "member" : "members"} · {workspace.role}</small></span>
      <ChevronsUpDown size={15} aria-hidden/>
    </button>
    {open && <div className="menu switcher-menu" role="menu">
      <div className="menu-label">Workspaces</div>
      {!orgs ? <Spinner label="Loading"/> : orgs.map((org) => <button key={org.id} role="menuitem" type="button" className="menu-item" onClick={() => void switchTo(org.id)}>
        <span className="ws-avatar sm">{org.name.slice(0, 1).toUpperCase()}</span><span className="grow">{org.name}</span>{org.id === workspace.id && <Check size={15}/>}
      </button>)}
      <div className="menu-sep"/>
      <button type="button" role="menuitem" className="menu-item" onClick={() => { setCreating(true); setOpen(false); }}><Plus size={15}/> New workspace</button>
    </div>}
    {creating && <Modal title="Create a workspace" description="Each workspace keeps its own customers, projects and team." onClose={() => setCreating(false)} busy={busy} size="sm" footer={<>
      <Button onClick={() => setCreating(false)} disabled={busy}>Cancel</Button>
      <Button variant="primary" type="submit" form="new-ws" busy={busy}>Create workspace</Button>
    </>}>
      <form id="new-ws" className="form-grid" onSubmit={create}>
        <Field label="Workspace name"><input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Studio"/></Field>
        {error && <div className="alert alert-error">{error}</div>}
      </form>
    </Modal>}
  </div>;
}

const SEEN_KEY = "omnidesk-activity-seen";
function Notifications() {
  const { workspace, dataVersion } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [seen, setSeen] = useState(() => localStorage.getItem(SEEN_KEY + ":" + workspace.id) ?? "");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    api.activity(undefined, controller.signal).then((r) => setItems(r.data.slice(0, 12))).catch(() => undefined);
    return () => controller.abort();
  }, [dataVersion, open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const unread = (items ?? []).filter((item) => !seen || item.createdAt > seen).length;
  function toggle() {
    setOpen((v) => !v);
    if (!open && items?.[0]) {
      localStorage.setItem(SEEN_KEY + ":" + workspace.id, items[0].createdAt);
      setSeen(items[0].createdAt);
    }
  }
  return <div className="notif" ref={ref}>
    <IconButton label={unread ? unread + " new updates" : "Workspace updates"} onClick={toggle} aria-expanded={open}>
      <Bell size={18}/>{unread > 0 && <span className="dot" aria-hidden>{unread > 9 ? "9+" : unread}</span>}
    </IconButton>
    {open && <div className="menu notif-menu" role="dialog" aria-label="Workspace updates">
      <div className="menu-head"><strong>Workspace updates</strong><Link to="/reports#activity" onClick={() => setOpen(false)}>View all</Link></div>
      {!items ? <Spinner/> : items.length === 0 ? <p className="menu-empty">No activity yet. Changes your team makes will show up here.</p> :
        items.map((item) => <div key={item.id} className="notif-item"><Avatar name={item.actorName} size={26}/><p><strong>{item.actorName ?? "Someone"}</strong> {item.summary}<small>{relativeTime(item.createdAt)}</small></p></div>)}
    </div>}
  </div>;
}

function UserMenu() {
  const { user } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return <div className="user-menu" ref={ref}>
    <button type="button" className="user-button" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}><Avatar name={user.name} size={32}/></button>
    {open && <div className="menu user-dropdown" role="menu">
      <div className="menu-user"><Avatar name={user.name} size={34}/><div><strong>{user.name}</strong><small>{user.email.endsWith(".invalid") ? "Demo visitor" : user.email}</small></div></div>
      <div className="menu-sep"/>
      <Link role="menuitem" className="menu-item" to="/settings" onClick={() => setOpen(false)}><Settings2 size={15}/> Settings</Link>
      <button role="menuitem" type="button" className="menu-item" onClick={() => void authClient.signOut().then(() => window.location.assign("/"))}><LogOut size={15}/> Sign out</button>
    </div>}
  </div>;
}

function NotFound() {
  return <div className="not-found"><h1>Page not found</h1><p>That page doesn't exist or was moved.</p><Link className="btn btn-primary" to="/">Back to overview</Link></div>;
}

export default function App() {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const theme = useTheme();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const current = NAV.find((item) => item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path));

  useEffect(() => { setDrawer(false); }, [location.pathname]);
  useEffect(() => { document.title = (current ? current.label + " · " : "") + "OmniDesk"; }, [current]);
  const onKey = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette((v) => !v); }
    const target = event.target as HTMLElement;
    if (event.key === "/" && !palette && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) { event.preventDefault(); setPalette(true); }
  }, [palette]);
  useEffect(() => { window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onKey]);

  return <div className="shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className={"sidebar" + (drawer ? " open" : "")} aria-label="Main navigation">
      <div className="sidebar-top">
        <Link to="/" className="brand" aria-label="OmniDesk home"><Logo/><span className="brand-text">omni<span>desk</span></span></Link>
        <IconButton label="Close menu" className="drawer-close" onClick={() => setDrawer(false)}><X size={18}/></IconButton>
      </div>
      <WorkspaceSwitcher/>
      <nav className="nav">
        {NAV.map((item) => <NavLink key={item.path} to={item.path} end={item.path === "/"} className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
          <item.icon size={18} aria-hidden/><span>{item.label}</span>
        </NavLink>)}
      </nav>
      <div className="sidebar-foot">
        <button type="button" className="search-hint" onClick={() => setPalette(true)}><Search size={15}/> Quick search <kbd>⌘K</kbd></button>
        <p className="sidebar-note"><Activity size={13}/> Every change is recorded in the activity log.</p>
      </div>
    </aside>
    {drawer && <div className="drawer-scrim" onClick={() => setDrawer(false)} aria-hidden/>}
    <div className="main">
      {workspace.isDemo && <div className="demo-banner"><Sparkles size={15}/><span>You're exploring a private demo workspace with sample data. It's deleted automatically after 24 hours.</span><button type="button" onClick={() => void authClient.signOut().then(() => window.location.assign("/"))}>Exit demo</button></div>}
      <header className="topbar">
        <IconButton label="Open menu" className="menu-toggle" onClick={() => setDrawer(true)}><Menu size={20}/></IconButton>
        <div className="crumb"><span>{workspace.name}</span><span aria-hidden>/</span><strong>{current?.label ?? "OmniDesk"}</strong></div>
        <div className="top-actions">
          <button type="button" className="search-button" onClick={() => setPalette(true)}><Search size={16}/><span>Search…</span><kbd>⌘K</kbd></button>
          <IconButton label={theme.resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={theme.toggle}>{theme.resolved === "dark" ? <Sun size={18}/> : <Moon size={18}/>}</IconButton>
          <Notifications/>
          <UserMenu/>
        </div>
      </header>
      <main id="main" className="content" tabIndex={-1}>
        <Suspense fallback={<Spinner/>}>
          <Routes>
            <Route path="/" element={<OverviewPage/>}/>
            <Route path="/customers" element={<CustomersPage/>}/>
            <Route path="/projects" element={<ProjectsPage/>}/>
            <Route path="/projects/:id" element={<ProjectDetailPage/>}/>
            <Route path="/tasks" element={<TasksPage/>}/>
            <Route path="/documents" element={<DocumentsPage/>}/>
            <Route path="/documents/:id" element={<DocumentPage/>}/>
            <Route path="/reports" element={<ReportsPage/>}/>
            <Route path="/team" element={<TeamPage/>}/>
            <Route path="/settings" element={<SettingsPage theme={theme}/>}/>
            <Route path="/invite/:id" element={<InvitePage/>}/>
            <Route path="*" element={<NotFound/>}/>
          </Routes>
        </Suspense>
      </main>
      <footer className="app-footer"><span>© 2026 OmniDesk</span><span>One workspace. Clearer operations.</span></footer>
    </div>
    {palette && <CommandPalette pages={NAV} onClose={() => setPalette(false)}/>}
    <button type="button" className="fab" aria-label="Quick search" onClick={() => setPalette(true)}><Search size={20}/></button>
  </div>;
}
