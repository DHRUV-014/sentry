import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BRAND } from "../lib/brand";
import { useSignedIn } from "../lib/auth";
import { navigate, useLocation } from "../lib/router";
import Link from "./Link";
import { focusRing, Logo, Spinner, ThemeToggle } from "./ui";

export { default as Link } from "./Link";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/demo", label: "Live call" },
  { to: "/check", label: "Check a caller" },
];

/** Header (logo, navigation, theme toggle, user menu) around every signed-in page. */
export default function AppShell({ children }: { children: ReactNode }) {
  const { path } = useLocation();
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 sm:px-6">
          <Link to="/dashboard" className={`flex items-center gap-2.5 rounded-md ${focusRing}`}>
            <Logo className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight">{BRAND}</span>
          </Link>
          <nav aria-label="Main" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto pb-1 sm:order-none sm:mx-0 sm:w-auto sm:pb-0">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                aria-current={path === n.to ? "page" : undefined}
                className={`whitespace-nowrap rounded-control px-3 py-2 text-sm font-medium transition-colors duration-150 ${focusRing} ${
                  path === n.to ? "bg-subtle text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

function UserMenu() {
  const { user, profile, signOutUser } = useSignedIn();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  const name = profile?.fullName || user.displayName || user.email || "";
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onMenuKey = (e: KeyboardEvent) => {
    const list = items.current.filter(Boolean) as HTMLElement[];
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      setOpen(false);
      button.current?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const signOut = () => {
    setSigningOut(true);
    navigate("/"); // back to the public landing page; it's visible signed in or out
    void signOutUser().catch(() => setSigningOut(false));
  };

  const item = `flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-subtle focus:bg-subtle focus:outline-none`;
  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-10 items-center gap-2 rounded-control py-1 pl-1 pr-2 transition-colors hover:bg-subtle ${focusRing}`}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-tint text-sm font-semibold text-accent" aria-hidden="true">
          {initial}
        </span>
        <span className="hidden max-w-40 truncate text-sm font-medium md:inline">{name}</span>
        <span className="sr-only md:hidden">Account menu for {name}</span>
        <ChevronDown size={16} strokeWidth={1.5} className="text-ink-2" aria-hidden="true" />
      </button>
      {open && (
        <div
          id="user-menu"
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-40 mt-2 w-64 animate-step rounded-card bg-surface p-1.5 shadow-lift ring-1 ring-line"
        >
          <div className="px-3 pb-2 pt-1.5">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-ink-2">{user.email}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link
            to="/onboarding?step=1"
            role="menuitem"
            ref={(el: HTMLAnchorElement | null) => (items.current[0] = el)}
            className={item}
            onClick={() => setOpen(false)}
          >
            <UserRound size={18} strokeWidth={1.5} className="text-ink-2" aria-hidden="true" />
            Your profile
          </Link>
          <button ref={(el) => (items.current[1] = el)} role="menuitem" type="button" disabled={signingOut} onClick={signOut} className={item}>
            {signingOut ? <Spinner className="h-[18px] w-[18px]" /> : <LogOut size={18} strokeWidth={1.5} className="text-ink-2" aria-hidden="true" />}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
