import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Download, History } from "lucide-react";
import { api, type ActivityItem } from "../lib/api";
import { CUSTOMER_STATUSES, PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES, errorMessage, formatDate, label } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useWorkspace } from "../lib/workspace";
import { Avatar, Badge, Button, EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton } from "../components/ui";

function TrendChart({ data }: { data: { week: string; created: number; completed: number }[] }) {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const height = width < 500 ? 200 : 250, pad = { l: 30, r: 26, t: 14, b: 30 };
  const every = width < 500 ? 2 : 1;
  const peak = Math.max(1, ...data.flatMap((d) => [d.created, d.completed]));
  const max = Math.ceil(peak / 4) * 4 || 4;
  const x = (i: number) => pad.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (width - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const path = (key: "created" | "completed") => data.map((d, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(d[key]).toFixed(1)).join(" ");
  const ticks = [0, max / 2, max];
  return <figure className="chart" ref={ref}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tasks created and completed per week">
      {ticks.map((t) => <g key={t}><line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="grid-line"/><text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="axis">{t}</text></g>)}
      {data.map((d, i) => (data.length - 1 - i) % every === 0 && <text key={d.week} x={x(i)} y={height - 8} textAnchor="middle" className="axis">{formatDate(d.week, { month: "short", day: "numeric" })}</text>)}
      <path d={path("created") + ` L ${x(data.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} className="area-created"/>
      <path d={path("created")} className="line-created"/>
      <path d={path("completed")} className="line-completed"/>
      {data.map((d, i) => <g key={"p" + d.week}><circle cx={x(i)} cy={y(d.created)} r={3.5} className="dot-created"><title>{d.created} created</title></circle><circle cx={x(i)} cy={y(d.completed)} r={3.5} className="dot-completed"><title>{d.completed} completed</title></circle></g>)}
    </svg>
    <figcaption className="legend"><span><i className="key-created"/>Created</span><span><i className="key-completed"/>Completed</span></figcaption>
  </figure>;
}

function Bars({ rows, tonePrefix }: { rows: { key: string; label: string; value: number; tone?: string }[]; tonePrefix: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return <ul className="bars">{rows.map((r) => <li key={r.key}><span className="bar-label">{r.label}</span><span className="bar-track"><span className={"bar-fill " + tonePrefix + (r.tone ?? r.key)} style={{ width: (r.value / max) * 100 + "%" }}/></span><strong>{r.value}</strong></li>)}</ul>;
}

function ActivityLog() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState("");
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  async function load(before?: string) {
    setBusy(true);
    try {
      const r = await api.activity(before);
      setItems((current) => [...(before ? current ?? [] : []), ...r.data]);
      setMore(r.data.length >= 40);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  if (error) return <ErrorState message={error} onRetry={() => { setError(""); void load(); }}/>;
  if (!items) return <Skeleton rows={5}/>;
  if (!items.length) return <EmptyState icon={<History size={20}/>} title="No activity yet">Changes to customers, projects, tasks and documents are logged here.</EmptyState>;
  return <>
    <ul className="timeline">{items.map((item) => <li key={item.id}><Avatar name={item.actorName} size={28}/><p><strong>{item.actorName ?? "Someone"}</strong> {item.summary}<small>{formatDate(item.createdAt, { dateStyle: "medium", timeStyle: "short" })}</small></p></li>)}</ul>
    {more && <div className="center-row"><Button busy={busy} onClick={() => void load(items.at(-1)?.createdAt)}>Load older activity</Button></div>}
  </>;
}

export default function ReportsPage() {
  const { can, dataVersion } = useWorkspace();
  const location = useLocation();
  const { data, error, loading, reload } = useAsync((signal) => api.reports(signal).then((r) => r.data), [dataVersion]);
  useEffect(() => { if (location.hash === "#activity" && data) document.getElementById("activity")?.scrollIntoView({ behavior: "smooth" }); }, [location.hash, data]);
  const totalTasks = data ? Object.values(data.tasksByStatus).reduce((a, b) => a + (b ?? 0), 0) : 0;
  const done = data?.tasksByStatus.done ?? 0;

  return <div className="stack">
    <PageHeader eyebrow="Reports" title="Reports" description="How work is flowing through your workspace."
      actions={can("data:export") && <div className="row-actions">
        {(["customers", "projects", "tasks"] as const).map((e) => <a key={e} className="btn btn-secondary btn-sm" href={api.exportUrl(e)} download><Download size={14}/><span>{e[0].toUpperCase() + e.slice(1)} CSV</span></a>)}
      </div>}/>
    {error && <ErrorState message={error} onRetry={reload}/>}
    {loading && !data && <div className="columns"><div className="card"><Skeleton rows={6}/></div><div className="card"><Skeleton rows={6}/></div></div>}
    {data && <>
      <section className="metrics">
        <div className="card metric"><div className="metric-top"><span>Total tasks</span></div><strong>{totalTasks}</strong><p>{done} done</p></div>
        <div className="card metric"><div className="metric-top"><span>Completion rate</span></div><strong>{totalTasks ? Math.round((done / totalTasks) * 100) : 0}%</strong><p>of all tasks</p></div>
        <div className="card metric"><div className="metric-top"><span>Completed · 8 weeks</span></div><strong>{data.trend.reduce((a, d) => a + d.completed, 0)}</strong><p>{data.trend.reduce((a, d) => a + d.created, 0)} created</p></div>
        <div className="card metric"><div className="metric-top"><span>Active customers</span></div><strong>{data.customersByStatus.active ?? 0}</strong><p>{data.customersByStatus.lead ?? 0} leads</p></div>
      </section>
      <section className="card"><div className="card-head"><div><h2>Weekly throughput</h2><p>Tasks created vs. completed over the last 8 weeks</p></div></div><TrendChart data={data.trend}/></section>
      <section className="columns">
        <article className="card"><div className="card-head"><div><h2>Tasks by status</h2></div></div>
          <Bars tonePrefix="pipe-" rows={TASK_STATUSES.map((s) => ({ key: s.value, label: s.label, value: data.tasksByStatus[s.value] ?? 0 }))}/></article>
        <article className="card"><div className="card-head"><div><h2>Open tasks by priority</h2></div></div>
          <Bars tonePrefix="prio-bg-" rows={TASK_PRIORITIES.map((p) => ({ key: p.value, label: p.label, value: data.openByPriority[p.value] ?? 0 })).reverse()}/></article>
      </section>
      <section className="columns">
        <article className="card"><div className="card-head"><div><h2>Workload</h2><p>Open tasks per person</p></div></div>
          {data.workload.length === 0 ? <p className="muted small">No open, assigned tasks.</p> : <Bars tonePrefix="bar-" rows={data.workload.map((w, i) => ({ key: w.name + i, tone: "accent", label: w.name, value: w.total }))}/>}</article>
        <article className="card"><div className="card-head"><div><h2>Customers</h2><p>By relationship status</p></div></div>
          <Bars tonePrefix="cust-" rows={CUSTOMER_STATUSES.map((s) => ({ key: s.value, label: s.label, value: data.customersByStatus[s.value] ?? 0 }))}/></article>
      </section>
      <section className="card flush">
        <div className="card-head pad"><div><h2>Project progress</h2><p>Share of tasks completed</p></div></div>
        {data.projects.length === 0 ? <p className="muted small pad">No projects yet.</p> : <ul className="list">{data.projects.map((p) => <li key={p.id}><Link className="list-row" to={"/projects/" + p.id}>
          <span className="grow"><strong>{p.name}</strong><small>{p.dueDate ? "Due " + formatDate(p.dueDate) : "No deadline"}</small></span>
          <Badge tone={p.status}>{label(PROJECT_STATUSES, p.status)}</Badge>
          <span className="progress-cell"><ProgressBar value={p.done} total={p.total} label={p.name}/><small>{p.done}/{p.total}</small></span>
        </Link></li>)}</ul>}
      </section>
    </>}
    <section className="card" id="activity"><div className="card-head"><div><h2>Activity history</h2><p>Every change, newest first</p></div></div><ActivityLog/></section>
  </div>;
}
