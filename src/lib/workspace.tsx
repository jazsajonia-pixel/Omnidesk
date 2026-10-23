import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { Permissions, Workspace } from "./api";

type Toast = { id: number; tone: "success" | "error" | "info"; message: string };
type WorkspaceContextValue = {
  workspace: Workspace;
  user: { id: string; name: string; email: string };
  can: (action: keyof Permissions) => boolean;
  refreshWorkspace: () => Promise<void>;
  notify: (message: string, tone?: Toast["tone"]) => void;
  dataVersion: number;
  bumpData: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ workspace, user, refreshWorkspace, children }: {
  workspace: Workspace; user: { id: string; name: string; email: string }; refreshWorkspace: () => Promise<void>; children: ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const counter = useRef(0);
  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = ++counter.current;
    setToasts((current) => [...current.slice(-3), { id, tone, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);
  const value = useMemo<WorkspaceContextValue>(() => ({
    workspace, user, refreshWorkspace, notify, dataVersion,
    can: (action) => Boolean(workspace.permissions[action]),
    bumpData: () => setDataVersion((v) => v + 1),
  }), [workspace, user, refreshWorkspace, notify, dataVersion]);
  return <WorkspaceContext.Provider value={value}>
    {children}
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => <div key={toast.id} className={"toast " + toast.tone} role={toast.tone === "error" ? "alert" : "status"}>{toast.message}</div>)}
    </div>
  </WorkspaceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}
