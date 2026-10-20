import { useSyncExternalStore } from "react";
import type { Level } from "./types";

// "Recent checks" on the dashboard: a summary of each real /check result, kept in this browser
// only. Deliberately minimal: who the caller claimed to be, the level and when. Never phone
// numbers, UPI IDs, links or message text.
export interface RecentCheck {
  at: string; // ISO time
  level: Level;
  claimed: string; // e.g. "State Bank of India" or "Police / CBI"
  verdict: string | null; // official-number verdict, e.g. "MISMATCH"
}

const KEY = "sentry-recent-checks";
const EVENT = "app:recent-checks";
const MAX = 5;
let cache: { raw: string | null; list: RecentCheck[] } = { raw: null, list: [] };

function read(): RecentCheck[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache.list;
  }
  if (raw === cache.raw) return cache.list;
  let list: RecentCheck[] = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed.slice(0, MAX);
  } catch {
    list = [];
  }
  cache = { raw, list };
  return list;
}

export function addRecentCheck(c: RecentCheck) {
  try {
    localStorage.setItem(KEY, JSON.stringify([c, ...read()].slice(0, MAX)));
  } catch {
    return; // storage blocked: the check itself still worked
  }
  window.dispatchEvent(new Event(EVENT));
}

export function clearRecentChecks() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useRecentChecks(): RecentCheck[] {
  return useSyncExternalStore(subscribe, read);
}

/** "just now", "5 min ago", "3 h ago", else a date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
