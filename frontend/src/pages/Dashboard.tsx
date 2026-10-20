import { ArrowRight, FileAudio, History, Mic, ScanSearch, UserRound, Users } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import Link from "../components/Link";
import { Card, EmptyState, RiskBadge, buttonClass, focusRing } from "../components/ui";
import { useSignedIn } from "../lib/auth";
import { EASE } from "../lib/brand";
import { formatMobile, labelOf, LANGUAGES, RELATIONSHIPS } from "../lib/profile";
import { clearRecentChecks, timeAgo, useRecentChecks } from "../lib/recentChecks";

const VERDICT_TEXT: Record<string, string> = {
  MATCH: "Official number verified",
  MISMATCH: "Number didn't match the official one",
  UNKNOWN: "Number not verified",
  UNAVAILABLE: "Online check unavailable",
};

function greeting(hour = new Date().getHours()) {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE, delay },
});

export default function Dashboard() {
  const { profile } = useSignedIn();
  const firstName = profile?.fullName.split(/\s+/)[0] ?? "";

  return (
    <main className="mx-auto max-w-content space-y-10 px-4 py-8 sm:px-6 sm:py-12">
      <motion.div {...rise(0)}>
        <h1 className="font-display text-3xl font-normal tracking-normal sm:text-4xl">
          {greeting()}
          {firstName && `, ${firstName}`}
        </h1>
        <p className="mt-2 text-lg text-ink-2">What would you like to do today?</p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div {...rise(0.08)}>
          <ActionCard
            to="/demo"
            icon={FileAudio}
            title="Analyse a recording"
            body="Upload a call recording and see exactly where the caller used pressure tactics."
            cta="Choose a recording"
          />
        </motion.div>
        <motion.div {...rise(0.16)}>
          <ActionCard
            to="/demo"
            icon={Mic}
            title="Start live protection"
            body="Sentry listens while you're on a call and warns you, in plain words, if it sounds like a scam."
            cta="Start listening"
          />
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div {...rise(0.24)} className="lg:col-span-2">
          <RecentChecks />
        </motion.div>
        <motion.div {...rise(0.3)} className="space-y-6">
          <TrustedContact />
          <Details />
        </motion.div>
      </div>
    </main>
  );
}

function ActionCard({ to, icon: Icon, title, body, cta }: { to: string; icon: typeof Mic; title: string; body: string; cta: string }) {
  return (
    <Link
      to={to}
      className={`group flex h-full flex-col rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-lift motion-reduce:hover:translate-y-0 sm:p-8 ${focusRing}`}
    >
      <div className="flex items-center gap-4">
        <span className="relative flex h-14 w-14 items-center justify-center rounded-card bg-accent-tint text-accent">
          <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
        </span>
        {/* A small waveform that wakes up on hover. */}
        <span className="flex h-8 items-center gap-1" aria-hidden="true">
          {[0.35, 0.7, 1, 0.55, 0.8, 0.4].map((h, i) => (
            <span
              key={i}
              className="w-1 origin-center rounded-full bg-accent/30 transition-colors duration-300 group-hover:animate-[wave_1.1s_ease-in-out_infinite] group-hover:bg-accent/70"
              style={{ height: `${h * 100}%`, animationDelay: `${i * 90}ms` }}
            />
          ))}
        </span>
      </div>
      <h2 className="mt-6 text-xl font-semibold">{title}</h2>
      <p className="mt-2 flex-1 text-base text-ink-2">{body}</p>
      <span className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-accent">
        {cta}
        <ArrowRight size={18} strokeWidth={1.5} className="transition-transform duration-300 ease-out group-hover:translate-x-1" aria-hidden="true" />
      </span>
    </Link>
  );
}

function RecentChecks() {
  const checks = useRecentChecks();
  const now = Date.now();
  return (
    <Card className="p-6" aria-labelledby="recent-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="recent-h" className="text-lg font-semibold">
            Recent checks
          </h2>
          <p className="text-xs text-ink-2">Saved only in this browser</p>
        </div>
        <div className="flex items-center gap-1">
          {checks.length > 0 && (
            <button type="button" onClick={clearRecentChecks} className={`${buttonClass("ghost")} min-h-10 text-sm`}>
              Clear
            </button>
          )}
          <Link to="/check" className={`${buttonClass("secondary")} min-h-10 text-sm`}>
            <ScanSearch size={18} strokeWidth={1.5} aria-hidden="true" />
            Check a caller
          </Link>
        </div>
      </div>
      {checks.length === 0 ? (
        <EmptyState icon={History} title="No checks yet">
          When someone calls claiming to be your bank, the police or a courier, check them here. Results appear in this list.
        </EmptyState>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {checks.map((c, i) => (
            <motion.li
              key={c.at}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.3 + i * 0.06 }}
              className="flex items-center gap-4 py-3.5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-2">
                <ScanSearch size={18} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">Claimed: {c.claimed}</div>
                <div className="truncate text-sm text-ink-2">
                  {c.verdict && VERDICT_TEXT[c.verdict] ? `${VERDICT_TEXT[c.verdict]} · ` : ""}
                  <time dateTime={c.at} className="tabular-nums">
                    {timeAgo(c.at, now)}
                  </time>
                </div>
              </div>
              <RiskBadge level={c.level} />
            </motion.li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TrustedContact() {
  const { profile } = useSignedIn();
  const contact = profile?.trustedContact;
  return (
    <Card className="p-6" aria-labelledby="contact-h">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-tint text-accent">
          <Users size={18} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h2 id="contact-h" className="text-lg font-semibold">
          Trusted contact
        </h2>
      </div>
      {contact ? (
        <>
          <p className="mt-4 text-base font-medium">
            {contact.name} <span className="font-normal text-ink-2">· {labelOf(RELATIONSHIPS, contact.relationship)}</span>
          </p>
          <p className="text-sm tabular-nums text-ink-2">{formatMobile(contact.mobile)}</p>
          <p className="mt-4 rounded-control bg-subtle p-3 text-sm text-ink-2">
            Text and WhatsApp alerts to your trusted contact are coming soon. Today, warnings appear on your screen during the call.
          </p>
          <Link to="/onboarding?step=2" className={`${buttonClass("secondary")} mt-4`}>
            Change contact
          </Link>
        </>
      ) : (
        <>
          <p className="mt-4 text-base text-ink-2">No trusted contact yet. Add a family member or friend who can check on you if a call looks like a scam.</p>
          <Link to="/onboarding?step=2" className={`${buttonClass("primary")} mt-4`}>
            Add trusted contact
          </Link>
        </>
      )}
    </Card>
  );
}

function Details() {
  const { profile } = useSignedIn();
  return (
    <Card className="p-6" aria-labelledby="details-h">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-subtle text-ink-2">
          <UserRound size={18} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h2 id="details-h" className="text-lg font-semibold">
          Your details
        </h2>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <Detail label="Name">{profile?.fullName}</Detail>
        <Detail label="Mobile">{formatMobile(profile?.mobile)}</Detail>
        <Detail label="Language">{labelOf(LANGUAGES, profile?.language)}</Detail>
      </dl>
      <Link to="/onboarding?step=1" className={`${buttonClass("ghost")} -ml-4 mt-2`}>
        Edit details
      </Link>
    </Card>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-ink-2">{label}</dt>
      <dd className="min-w-0 truncate font-medium tabular-nums">{children}</dd>
    </div>
  );
}
