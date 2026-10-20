import { useEffect, useState } from "react";
import { Activity, ArrowRight, BriefcaseBusiness, CheckSquare, CalendarClock, LoaderCircle, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { getDashboardSummary, type DashboardSummary } from "../lib/api";

type LoadState = "loading" | "loaded" | "error";

export default function OverviewPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    getDashboardSummary(controller.signal).then((data) => {
      setSummary(data);
      setState("loaded");
    }).catch(() => {
      if (!controller.signal.aborted) setState("error");
    });
    return () => controller.abort();
  }, [attempt]);

  const metrics = [
    { label: "Customers", icon: Users, value: state === "loaded" ? String(summary?.customers ?? 0) : "—", detail: state === "loaded" ? "Active customer records" : state === "error" ? "Could not load customer count" : "Loading customer count" },
    { label: "Active projects", icon: BriefcaseBusiness, value: "—", detail: "Projects are coming next" },
    { label: "Open tasks", icon: CheckSquare, value: "—", detail: "Task data not available yet" },
    { label: "Overdue tasks", icon: CalendarClock, value: "—", detail: "Task data not available yet" },
  ];

  return <div className="stack">
    <section className="welcome">
      <div><div className="eyebrow">WORKSPACE OVERVIEW</div><h1>Good work starts with clarity.</h1><p>Your operations, gathered in one place.</p></div>
      <span className="chip">{state === "loaded" ? "Live customer data" : state === "error" ? "Customer data unavailable" : <><LoaderCircle size={14} className="spin"/> Loading workspace data</>}</span>
    </section>
    <section className="metrics">
      {metrics.map((metric) => <article className="metric" key={metric.label}>
        <div className="metric-label">{metric.label}<span className="metric-icon"><metric.icon size={17}/></span></div>
        <strong>{metric.value}</strong><p>{metric.detail}</p>
        {metric.label === "Customers" && state === "error" && <button className="metric-retry" type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button>}
      </article>)}
    </section>
    <section className="columns">
      <article className="panel">
        <div className="panel-heading"><div><h2>Workspace activity</h2><p>Activity history will appear when audit events are enabled.</p></div><span className="pill">Not enabled</span></div>
        <div className="activity"><Activity size={20}/><div><strong>Your activity feed is ready</strong><p>Customer updates are saved. The shared activity feed is planned for a later phase.</p></div></div>
      </article>
      <article className="panel">
        <div className="panel-heading"><div><h2>Getting started</h2><p>Build your workspace step by step.</p></div><span className="pill">Next steps</span></div>
        <div className="setup"><span>✓</span><label>Secure sign-in and workspace</label><small>Ready</small></div>
        <div className="setup"><span>✓</span><label>Customer records</label><small>Available</small></div>
        <div className="setup"><span>3</span><label>Projects and tasks</label><small>Coming next</small></div>
        <div className="setup"><span>4</span><label>Team and automation</label><small>Planned</small></div>
      </article>
    </section>
    <div className="notice"><Sparkles size={17}/><div><strong>Customer data comes from your workspace database.</strong><p>Counts are scoped to your active organization. Project and task metrics stay blank until those modules are implemented.</p></div><Link className="notice-link" to="/customers" aria-label="Open customer records"><ArrowRight size={17}/></Link></div>
  </div>;
}
