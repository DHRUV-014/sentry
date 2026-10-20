import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { useSignedIn } from "../lib/auth";
import { navigate, useLocation } from "../lib/router";
import { Logo, Spinner } from "./ui";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/demo", label: "Live call" },
  { to: "/check", label: "Check a caller" },
];

/** Same-tab navigation without a reload; modified clicks (new tab etc.) behave as normal links. */
export function Link({ to, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a {...rest} href={to} onClick={onClick}>
      {children}
    </a>
  );
}

/** Header with navigation and sign-out around every signed-in page. `theme="dark"` keeps the
 *  live-call pages in their dark projector style regardless of the system setting. */
export default function AppShell({ theme, children }: { theme?: "dark"; children: ReactNode }) {
  const { user, profile, signOutUser } = useSignedIn();
  const { path } = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  const name = profile?.fullName || user.displayName || user.email || "";
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">Scam Shield</span>
          </Link>
          <nav aria-label="Main" className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                aria-current={path === n.to ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-base font-medium focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                  path === n.to ? "bg-subtle text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden max-w-56 truncate text-base text-muted md:inline" title={user.email ?? ""}>
              {name}
            </span>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOutUser().catch(() => setSigningOut(false));
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-base font-semibold text-ink ring-1 ring-inset ring-line hover:bg-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 disabled:opacity-60"
            >
              {signingOut && <Spinner className="h-4 w-4" />}
              Sign out
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
