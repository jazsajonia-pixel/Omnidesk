import type { ReactNode } from "react";

/** Minimal, safe Markdown rendering (headings, lists, quotes, bold, italics, code). Links allow only http(s) and mailto. No raw HTML. */
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const href = link?.[2] ?? "";
      if (link && /^(https?:\/\/|mailto:)/i.test(href)) parts.push(<a key={key++} href={href} target="_blank" rel="noopener noreferrer">{link[1]}</a>);
      else parts.push(link?.[1] ?? token);
    }
    else parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let index = 0;
  let key = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = inline(heading[2]);
      blocks.push(level === 1 ? <h2 key={key++}>{content}</h2> : level === 2 ? <h3 key={key++}>{content}</h3> : <h4 key={key++}>{content}</h4>);
      index++;
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: ReactNode[] = [];
      while (index < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[index])) {
        const text = lines[index].replace(/^\s*([-*]|\d+\.)\s+/, "");
        const checkbox = /^\[( |x)\]\s+(.*)$/i.exec(text);
        items.push(<li key={items.length} className={checkbox ? "check-item" : undefined}>{checkbox ? <><input type="checkbox" checked={checkbox[1].toLowerCase() === "x"} readOnly tabIndex={-1}/> {inline(checkbox[2])}</> : inline(text)}</li>);
        index++;
      }
      blocks.push(ordered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>);
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith(">")) { quote.push(lines[index].replace(/^>\s?/, "")); index++; }
      blocks.push(<blockquote key={key++}>{inline(quote.join(" "))}</blockquote>);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,3}\s|>|\s*([-*]|\d+\.)\s+)/.test(lines[index])) { paragraph.push(lines[index]); index++; }
    blocks.push(<p key={key++}>{inline(paragraph.join(" "))}</p>);
  }
  return <div className="markdown">{blocks.length ? blocks : <p className="muted">This document is empty.</p>}</div>;
}
