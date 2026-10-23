import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { initials } from "../lib/format";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; busy?: boolean; size?: "sm" | "md"; icon?: ReactNode };
export function Button({ variant = "secondary", busy, size = "md", icon, children, className = "", disabled, ...rest }: ButtonProps) {
  return <button {...rest} disabled={disabled || busy} className={["btn", "btn-" + variant, size === "sm" ? "btn-sm" : "", className].filter(Boolean).join(" ")}>
    {busy ? <LoaderCircle size={16} className="spin" aria-hidden/> : icon}
    {children && <span>{children}</span>}
  </button>;
}

export function IconButton({ label, children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button {...rest} className={"icon-btn " + className} aria-label={label} title={label}>{children}</button>;
}

export function Badge({ tone = "default", children }: { tone?: string; children: ReactNode }) {
  return <span className={"badge badge-" + tone}>{children}</span>;
}

export function Avatar({ name, size = 30 }: { name: string | null | undefined; size?: number }) {
  const hue = [...(name ?? "?")].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  return <span className="avatar" style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36), ["--avatar-hue" as string]: String(hue) }} aria-hidden>{initials(name)}</span>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div className="loading-row" role="status"><LoaderCircle size={18} className="spin" aria-hidden/> {label}</div>;
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return <div className="skeleton-list" aria-hidden>{Array.from({ length: rows }, (_, index) => <div key={index} className="skeleton" style={{ width: 92 - (index % 3) * 14 + "%" }}/>)}</div>;
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty-state">
    <div className="empty-icon">{icon}</div>
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {action && <div className="empty-action">{action}</div>}
  </div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="error-state" role="alert">
    <AlertTriangle size={18} aria-hidden/>
    <div><strong>Couldn't load this</strong><p>{message}</p></div>
    {onRetry && <Button size="sm" onClick={onRetry}>Try again</Button>}
  </div>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return <header className="page-header">
    <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>;
}

export function Modal({ title, description, onClose, children, footer, size = "md", busy }: {
  title: string; description?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg"; busy?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("input, textarea, select, button:not(.modal-close)");
    first?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key === "Tab" && panel.current) {
        const focusable = [...panel.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((el) => !el.hasAttribute("disabled"));
        if (!focusable.length) return;
        const [start, end] = [focusable[0], focusable[focusable.length - 1]];
        if (event.shiftKey && document.activeElement === start) { event.preventDefault(); end.focus(); }
        else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); start.focus(); }
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("modal-open"); previous?.focus?.(); };
  }, [busy, onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={panel} className={"modal modal-" + size} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="modal-head">
        <div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
        <IconButton label="Close" className="modal-close" onClick={onClose} disabled={busy}><X size={18}/></IconButton>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </div>
  </div>;
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirm", tone = "danger", busy, error, onCancel, onConfirm }: {
  title: string; message: ReactNode; confirmLabel?: string; tone?: "danger" | "primary"; busy?: boolean; error?: string; onCancel: () => void; onConfirm: () => void;
}) {
  return <Modal title={title} onClose={onCancel} size="sm" busy={busy} footer={<>
    <Button onClick={onCancel} disabled={busy}>Cancel</Button>
    <Button variant={tone} busy={busy} onClick={onConfirm}>{confirmLabel}</Button>
  </>}>
    <p className="confirm-text">{message}</p>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
  </Modal>;
}

export function Field({ label, hint, optional, children }: { label: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return <label className="field">
    <span className="field-label">{label}{optional && <em>Optional</em>}</span>
    {children}
    {hint && <small className="field-hint">{hint}</small>}
  </label>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return <div className="segmented" role="radiogroup" aria-label={label}>
    {options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? "selected" : ""} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}

export function ProgressBar({ value, total, label }: { value: number; total: number; label?: string }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
    <span style={{ width: percent + "%" }}/>
  </div>;
}
