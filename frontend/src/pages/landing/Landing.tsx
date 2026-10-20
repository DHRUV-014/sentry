import { ArrowRight } from "lucide-react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { lazy, Suspense, useState } from "react";
import Link from "../../components/Link";
import { Logo, Skeleton, ThemeToggle, buttonClass, focusRing } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { BRAND, EASE, TAGLINE } from "../../lib/brand";
import HeroCall from "./HeroCall";

// Everything below the hero is a separate chunk, fetched right after first paint.
const Sections = lazy(() => import("./Sections"));

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#truth", label: "Truth check" },
  { href: "#privacy", label: "Privacy" },
];

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-clip bg-canvas text-ink">
      <a href="#main" className={`sr-only z-50 rounded-control bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 ${focusRing}`}>
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Hero />
        <Suspense fallback={<div className="min-h-screen" />}>
          <Sections />
        </Suspense>
      </main>
    </div>
  );
}

/** Signed out: Sign in + Get started. Signed in: Go to dashboard. Nothing while auth is still loading. */
export function AuthActions({ size = "md" }: { size?: "md" | "lg" }) {
  const { state } = useAuth();
  if (state.status === "loading") return <Skeleton className="h-11 w-44" />;
  if (state.status === "signedIn")
    return (
      <Link to="/dashboard" className={buttonClass("primary", size)}>
        Go to dashboard
        <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
      </Link>
    );
  return (
    <div className="flex items-center gap-2">
      <Link to="/auth" className={buttonClass("ghost", size)}>
        Sign in
      </Link>
      <Link to="/auth?mode=signup" className={buttonClass("primary", size)}>
        Get started
      </Link>
    </div>
  );
}

function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300 ease-out ${
        scrolled ? "border-b border-line/80 bg-canvas/80 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-content items-center gap-6 px-4 sm:px-6">
        <Link to="/" className={`flex items-center gap-2.5 rounded-md ${focusRing}`}>
          <Logo className="h-7 w-7" />
          <span className="text-lg font-semibold tracking-tight">{BRAND}</span>
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className={`rounded-control px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:text-ink ${focusRing}`}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <AuthActions />
        </div>
      </div>
    </header>
  );
}

const HEADLINE = TAGLINE.split(" ");

function Hero() {
  return (
    <section className="relative px-4 pb-16 pt-28 sm:px-6 sm:pt-36 lg:pb-28">
      <div className="mx-auto grid max-w-content items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink-2 ring-1 ring-line"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            Scam-call protection · English · हिन्दी · Hinglish
          </motion.p>
          <h1 className="mt-6 font-display text-3xl font-normal leading-[1.05] tracking-[-0.01em] sm:text-4xl">
            <span className="sr-only">{TAGLINE}</span>
            <span aria-hidden="true">
              {HEADLINE.map((w, i) => (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.06 }}
                >
                  {w}&nbsp;
                </motion.span>
              ))}
            </span>
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.55 }}
            className="mt-6 max-w-xl text-lg text-ink-2"
          >
            {BRAND} listens for scam patterns in calls and recordings, and checks what the caller claims against official sources, live.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <HeroPrimary />
            <a href="#how" className={buttonClass("secondary", "lg")}>
              See how it works
            </a>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
        >
          <p className="sr-only">
            Illustration: during a call, the caller says “This is SBI. Your account is blocked. Share the OTP now.” {BRAND} marks authority, urgency and an
            OTP request, the risk rises from low to high, and a truth check shows the number is not the bank's official one.
          </p>
          <HeroCall />
        </motion.div>
      </div>
    </section>
  );
}

function HeroPrimary() {
  const { state } = useAuth();
  if (state.status === "signedIn")
    return (
      <Link to="/dashboard" className={buttonClass("primary", "lg")}>
        Go to dashboard
        <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
      </Link>
    );
  return (
    <Link to="/auth?mode=signup" className={buttonClass("primary", "lg")}>
      Get started
      <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
    </Link>
  );
}
