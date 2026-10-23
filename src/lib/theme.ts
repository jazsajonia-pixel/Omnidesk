import { useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "omnidesk-theme";

function resolve(choice: ThemeChoice) {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyStoredTheme() {
  const choice = (localStorage.getItem(KEY) as ThemeChoice | null) ?? "system";
  document.documentElement.dataset.theme = resolve(choice);
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(() => (localStorage.getItem(KEY) as ThemeChoice | null) ?? "system");
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolve(choice));
  useEffect(() => {
    const update = () => {
      const next = resolve(choice);
      setResolved(next);
      document.documentElement.dataset.theme = next;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#0d1420" : "#f5f7fa");
    };
    update();
    localStorage.setItem(KEY, choice);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [choice]);
  return { choice, resolved, setChoice, toggle: () => setChoice(resolved === "dark" ? "light" : "dark") };
}
