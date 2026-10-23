import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BriefcaseBusiness, CheckSquare, CornerDownLeft, FileText, LoaderCircle, Search, Users } from "lucide-react";
import { api, type SearchResults } from "../lib/api";

type Item = { key: string; group: string; title: string; subtitle?: string | null; icon: typeof Search; to: string };

export function CommandPalette({ onClose, pages }: { onClose: () => void; pages: { label: string; path: string; icon: typeof Search }[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      api.search(query.trim(), controller.signal).then((r) => { setResults(r.data); setLoading(false); }).catch(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const pageItems = pages.filter((p) => !q || p.label.toLowerCase().includes(q)).map((p) => ({ key: "page-" + p.path, group: "Go to", title: p.label, icon: p.icon, to: p.path }));
    if (!results) return pageItems;
    return [
      ...results.customers.map((r) => ({ key: "c" + r.id, group: "Customers", title: r.title, subtitle: r.subtitle, icon: Users, to: "/customers?open=" + r.id })),
      ...results.projects.map((r) => ({ key: "p" + r.id, group: "Projects", title: r.title, subtitle: r.subtitle?.replace("_", " "), icon: BriefcaseBusiness, to: "/projects/" + r.id })),
      ...results.tasks.map((r) => ({ key: "t" + r.id, group: "Tasks", title: r.title, subtitle: r.subtitle?.replace("_", " "), icon: CheckSquare, to: "/tasks?open=" + r.id })),
      ...results.documents.map((r) => ({ key: "d" + r.id, group: "Documents", title: r.title, icon: FileText, to: "/documents/" + r.id })),
      ...pageItems,
    ];
  }, [pages, query, results]);

  useEffect(() => { setActive(0); }, [items.length]);

  function go(item: Item | undefined) {
    if (!item) return;
    navigate(item.to);
    onClose();
  }

  let lastGroup = "";
  return <div className="modal-backdrop palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
      <div className="palette-input">
        <Search size={18} aria-hidden/>
        <input ref={input} value={query} placeholder="Search customers, projects, tasks, documents…" aria-label="Search" onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((v) => Math.min(items.length - 1, v + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((v) => Math.max(0, v - 1)); }
            if (e.key === "Enter") { e.preventDefault(); go(items[active]); }
          }}/>
        {loading ? <LoaderCircle size={16} className="spin" aria-hidden/> : <kbd>Esc</kbd>}
      </div>
      <div className="palette-results" role="listbox">
        {items.length === 0 && <p className="palette-empty">{loading ? "Searching…" : "No matches. Try a different word."}</p>}
        {items.map((item, index) => {
          const header = item.group !== lastGroup ? <div className="palette-group" key={"g" + item.group}>{item.group}</div> : null;
          lastGroup = item.group;
          return [header, <button key={item.key} type="button" role="option" aria-selected={index === active} className={"palette-item" + (index === active ? " active" : "")} onMouseEnter={() => setActive(index)} onClick={() => go(item)}>
            <item.icon size={16} aria-hidden/><span className="palette-title">{item.title}</span>{item.subtitle && <span className="palette-sub">{item.subtitle}</span>}{index === active && <CornerDownLeft size={14} className="palette-enter" aria-hidden/>}
          </button>];
        })}
      </div>
    </div>
  </div>;
}
