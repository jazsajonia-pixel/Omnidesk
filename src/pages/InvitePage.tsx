import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Users } from "lucide-react";
import { authClient } from "../lib/auth-client";
import { api } from "../lib/api";
import { errorMessage, label, ROLES } from "../lib/format";
import { Button, Skeleton } from "../components/ui";

type Info = Awaited<ReturnType<typeof api.invitation>>["data"];

export default function InvitePage() {
  const { id = "" } = useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.invitation(id).then((r) => setInfo(r.data)).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false));
  }, [id]);
  async function accept() {
    setBusy(true);
    try {
      const r = await api.acceptInvitation(id);
      sessionStorage.removeItem("omnidesk-pending-invite");
      await authClient.organization.setActive({ organizationId: r.data.organizationId });
      window.location.assign("/");
    } catch (e) { setError(errorMessage(e)); setBusy(false); }
  }
  const usable = info && info.emailMatches && !info.expired && info.status === "pending";
  return <div className="stack narrow">
    <section className="card invite-card">
      <span className="empty-icon"><Users size={20}/></span>
      {loading ? <Skeleton rows={3}/> : <>
        <h1>{info ? "Join " + info.organizationName : "Invitation unavailable"}</h1>
        {info && <p className="muted">{info.inviterName ?? "A teammate"} invited <strong>{info.email}</strong> as {label(ROLES, info.role).toLowerCase()}.</p>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {info && !info.emailMatches && <div className="alert alert-warning">This invitation is for a different email address than the one you're signed in with.</div>}
        {info && (info.expired || info.status !== "pending") && <div className="alert alert-warning">This invitation is {info.expired ? "expired" : info.status}. Ask for a new one.</div>}
        <div className="row-actions center">
          <Link className="btn btn-secondary" to="/" onClick={() => sessionStorage.removeItem("omnidesk-pending-invite")}>Back to my workspace</Link>
          {usable && <Button variant="primary" busy={busy} icon={<ArrowRight size={16}/>} onClick={() => void accept()}>Accept and switch</Button>}
        </div>
      </>}
    </section>
  </div>;
}
