import { useSyncExternalStore } from "react";

// Light/dark: follows the system until the person picks one with the toggle. The choice is a
// per-browser convenience; index.html applies it before first paint.
type Theme = "light" | "dark";
const KEY = "sentry-theme";
const EVENT = "app:theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function resolved(): Theme {
  return stored() ?? (media.matches ? "dark" : "light");
}

function apply() {
  document.documentElement.dataset.theme = resolved();
  window.dispatchEvent(new Event(EVENT));
}

media.addEventListener("change", () => {
  if (!stored()) apply();
});

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, resolved);
  const toggle = () => {
    const next: Theme = resolved() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the toggle still works for this page view
      document.documentElement.dataset.theme = next;
      window.dispatchEvent(new Event(EVENT));
      return;
    }
    apply();
  };
  return { theme, toggle };
}
