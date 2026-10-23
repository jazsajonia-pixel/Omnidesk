/** OmniDesk mark: a rounded desk tile with an orbit, drawn to work from 20px up. */
export function Logo({ size = 34 }: { size?: number }) {
  return <svg className="logo" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="OmniDesk">
    <rect x="1" y="1" width="38" height="38" rx="11" fill="var(--accent)"/>
    <circle cx="20" cy="20" r="9.5" fill="none" stroke="var(--accent-ink)" strokeWidth="3.4"/>
    <path d="M8 27.5c5.5-2.2 18.5-2.2 24 0" fill="none" stroke="var(--accent-ink)" strokeWidth="3.4" strokeLinecap="round"/>
    <circle cx="29.5" cy="11" r="2.6" fill="var(--accent-ink)"/>
  </svg>;
}
