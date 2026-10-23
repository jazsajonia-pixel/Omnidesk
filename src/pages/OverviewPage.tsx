import { useState } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, ArrowRight, BriefcaseBusiness, CheckCircle2, CheckSquare, Database, FileText, Plus, Users } from "lucide-react";
import { api } from "../lib/api";
import { TASK_STATUSES, dueLabel, errorMessage, relativeTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useWorkspace } from "../lib/workspace";
import { Avatar, Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton } from "../components/ui";
import { TaskDialog } from "../components/TaskDialog";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default function OverviewPage() {
  const { user, can, notify, dataVersion, bumpData } = useWorkspace();
  const { data, error, loading, reload } = useAsync((signal) => api.dashboard(signal).then((r) => r.data), [dataVersion]);
  const [seeding, setSeeding] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const isEmpty = data && data.customers === 0 && data.projects.total === 0 && data.tasks.open + data.tasks.byStatus.done === 0;

  async function seed() {
    setSeeding(true);
    try {
      await api.sampleData();
      notify("Sample data added. Have a look around.");
      bumpData();
    } catch (reason) { notify(errorMessage(reason), "error"); }
    finally { setSeeding(false); }
  }

  const metrics = data ? [
    { label: "Open tasks", value: data.tasks.open, detail: data.tasks.mine + " assigned to you", icon: CheckSquare, to: "/tasks" },
    { label: "Overdue", value: data.tasks.overdue, detail: data.tasks.dueThisWeek + " more due this week", icon: AlarmClock, to: "/tasks?due=overdue", tone: data.tasks.overdue ? "danger" : "" },
    { label: "Active projects", value: data.projects.active, detail: data.projects.total + " projects in total", icon: BriefcaseBusiness, to: "/projects" },
    { label: "Customers", value: data.customers, detail: data.documents + " shared documents", icon: Users, to: "/customers" },
  ] : [];
  const statusTotal = data ? Object.values(data.tasks.byStatus).reduce((a, b) => a + b, 0) : 0;

  return <div className="stack">
    <PageHeader eyebrow="Overview" title={greeting() + ", " + (user.name.split(" ")[0] || "there") + "."} description="Here's what's moving in your workspace today."
      actions={can("task:write") && <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setNewTask(true)}>New task</Button>}/>

    {error && <ErrorState message={error} onRetry={reload}/>}
    {loading && !data && <div className="metrics">{[0, 1, 2, 3].map((i) => <div key={i} className="card metric"><Skeleton rows={2}/></div>)}</div>}

    {isEmpty && <section className="card welcome-card">
      <div>
        <h2>Your workspace is ready</h2>
        <p>Add your first customer, project or task, or load a realistic sample dataset to see how everything fits together.</p>
        <div className="row-actions">
          {can("workspace:manage") && <Button variant="primary" busy={seeding} icon={<Database size={16}/>} onClick={() => void seed()}>Load sample data</Button>}
          <Link className="btn btn-secondary" to="/customers">Add a customer</Link>
          <Link className="btn btn-ghost" to="/team">Invite your team</Link>
        </div>
      </div>
    </section>}

    {data && <>
      <section className="metrics">
        {metrics.map((m) => <Link key={m.label} to={m.to} className={"card metric metric-link " + (m.tone ?? "")}>
          <div className="metric-top"><span>{m.label}</span><span className="metric-icon"><m.icon size={17}/></span></div>
          <strong>{m.value}</strong><p>{m.detail}</p>
        </Link>)}
      </section>

      <section className="card">
        <div className="card-head"><div><h2>Task pipeline</h2><p>{data.tasks.completedThisWeek} completed in the last 7 days</p></div><Link className="text-link" to="/tasks">Open board <ArrowRight size={14}/></Link></div>
        {statusTotal === 0 ? <p className="muted small">No tasks yet.</p> : <>
          <div className="pipeline" aria-label="Tasks by status">
            {TASK_STATUSES.map((s) => data.tasks.byStatus[s.value] > 0 && <span key={s.value} className={"pipe pipe-" + s.value} style={{ flexGrow: data.tasks.byStatus[s.value] }} title={s.label + ": " + data.tasks.byStatus[s.value]}/>)}
          </div>
          <div className="pipeline-legend">{TASK_STATUSES.map((s) => <span key={s.value}><i className={"pipe-" + s.value}/>{s.label} <strong>{data.tasks.byStatus[s.value]}</strong></span>)}</div>
        </>}
      </section>

      <section className="columns">
        <article className="card">
          <div className="card-head"><div><h2>Upcoming deadlines</h2><p>Open tasks with the nearest due dates</p></div><Link className="text-link" to="/tasks">All tasks <ArrowRight size={14}/></Link></div>
          {data.upcoming.length === 0 ? <EmptyState icon={<CheckCircle2 size={20}/>} title="Nothing due">Tasks with due dates will show up here.</EmptyState> :
            <ul className="list">{data.upcoming.map((task) => {
              const due = dueLabel(task.dueDate);
              return <li key={task.id}><Link className="list-row" to={"/tasks?open=" + task.id}>
                <span className={"prio-dot prio-" + task.priority} aria-hidden/>
                <span className="grow"><strong>{task.title}</strong><small>{task.projectName ?? "No project"}{task.assigneeName ? " · " + task.assigneeName : ""}</small></span>
                <Badge tone={due.tone}>{due.text}</Badge>
              </Link></li>;
            })}</ul>}
        </article>
        <article className="card">
          <div className="card-head"><div><h2>Recent activity</h2><p>Latest changes across the workspace</p></div><Link className="text-link" to="/reports#activity">History <ArrowRight size={14}/></Link></div>
          {data.activity.length === 0 ? <EmptyState icon={<FileText size={20}/>} title="No activity yet">Changes your team makes are recorded here.</EmptyState> :
            <ul className="timeline">{data.activity.map((item) => <li key={item.id}><Avatar name={item.actorName} size={28}/><p><strong>{item.actorName ?? "Someone"}</strong> {item.summary}<small>{relativeTime(item.createdAt)}</small></p></li>)}</ul>}
        </article>
      </section>
    </>}
    {newTask && <TaskDialog onClose={() => setNewTask(false)} onSaved={() => { setNewTask(false); bumpData(); }}/>}
  </div>;
}
