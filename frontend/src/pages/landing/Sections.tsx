import {
  ArrowRight,
  AudioWaveform,
  BellRing,
  CircleCheck,
  EyeOff,
  FileAudio,
  Info,
  Mic,
  OctagonAlert,
  ScanSearch,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo, RiskBadge, Spinner, ThemeToggle, focusRing } from "../../components/ui";
import { BRAND, EASE, TAGLINE } from "../../lib/brand";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { AuthActions } from "./Landing";

// Landing sections below the hero. Every example is illustrative and says so; no invented numbers.

const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.4 },
  transition: { duration: 0.8, ease: EASE, delay },
});

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold text-accent">{children}</p>;
}

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <motion.div {...reveal()} className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">{title}</h2>
      {body && <p className="mt-4 text-lg text-ink-2">{body}</p>}
    </motion.div>
  );
}

/** Runs `tick` every `ms` while the element is on screen and motion is allowed. */
function useLoop(ref: React.RefObject<Element>, ms: number, tick: () => void) {
  const inView = useInView(ref, { amount: 0.35 });
  const reduce = useReducedMotion();
  const saved = useRef(tick);
  saved.current = tick;
  useEffect(() => {
    if (!inView || reduce) return;
    const id = window.setInterval(() => saved.current(), ms);
    return () => window.clearInterval(id);
  }, [inView, reduce, ms]);
  return { inView, reduce };
}

export default function Sections() {
  return (
    <>
      <Problem />
      <HowItWorks />
      <TruthShowcase />
      <Family />
      <Privacy />
      <FinalCta />
      <Footer />
    </>
  );
}

// ---------------------------------------------------------------- 3. problem

const PATTERN = [
  { tactic: "Authority", text: "They claim to be someone you trust: your bank, the police, a courier." },
  { tactic: "Urgency", text: "They create panic: your account is blocked, a parcel is held, you're under arrest." },
  { tactic: "Secrecy", text: "They rush you and isolate you: don't tell anyone, share the OTP, pay now." },
];

function Problem() {
  return (
    <section className="px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-content gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <div>
          <SectionTitle eyebrow="The problem" title="Scam calls follow a script." />
          <ol className="mt-10 space-y-6">
            {PATTERN.map((p, i) => (
              <motion.li key={p.tactic} {...reveal(0.1 + i * 0.12)} className="flex gap-4">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-risk-high-tint text-sm font-semibold tabular-nums text-ink">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink-2">{p.tactic}</div>
                  <p className="mt-0.5 text-xl leading-snug">{p.text}</p>
                </div>
              </motion.li>
            ))}
          </ol>
          <motion.p {...reveal(0.5)} className="mt-10 text-lg text-ink-2">
            Scripts have patterns. {BRAND} knows the patterns.
          </motion.p>
        </div>
        <motion.figure {...reveal(0.15)} className="self-center rounded-card bg-surface p-8 shadow-card ring-1 ring-line/70 sm:p-10">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-2">A reported case</div>
          <Counter to={2.96} prefix="₹" suffix=" lakh" />
          <blockquote className="mt-4 text-lg leading-relaxed">
            A 70-year-old woman in Indore lost ₹2.96 lakh after calling a fake helpline.
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-2 text-sm text-ink-2">
            <Info size={16} strokeWidth={1.5} aria-hidden="true" />
            One case is enough to show how ordinary these calls sound.
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}

function Counter({ to, prefix, suffix }: { to: number; prefix: string; suffix: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, to, { duration: 1.6, ease: EASE, onUpdate: setV });
    return () => c.stop();
  }, [inView, reduce, to]);
  return (
    <div ref={ref} className="mt-3 font-display text-4xl tabular-nums leading-none">
      <span className="sr-only">
        {prefix}
        {to}
        {suffix}
      </span>
      <span aria-hidden="true">
        {prefix}
        {v.toFixed(2)}
        {suffix}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- 4. how it works

const STEPS: { icon: LucideIcon; title: string; body: ReactNode }[] = [
  { icon: Mic, title: "Listen", body: "On a live call, or from a recording you upload." },
  {
    icon: AudioWaveform,
    title: "Detect",
    body: (
      <>
        AI spots pressure tactics, and AI-cloned voices <span className="whitespace-nowrap rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-ink-2">in development</span>
      </>
    ),
  },
  { icon: ScanSearch, title: "Verify", body: "TinyFish checks the caller's claims against official websites." },
];

function HowItWorks() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const reduce = useReducedMotion();
  return (
    <section id="how" className="bg-subtle/60">
      {desktop && !reduce ? <PinnedSteps /> : <StackedSteps />}
    </section>
  );
}

/** Desktop: the section pins while you scroll through the three steps; a line fills as you go. */
function PinnedSteps() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const fill = useTransform(scrollYProgress, [0.05, 0.9], [0, 1]);
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (p) => setActive(p < 0.33 ? 0 : p < 0.66 ? 1 : 2));
  return (
    <div ref={ref} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-screen items-center px-6">
        <div className="mx-auto grid w-full max-w-content grid-cols-2 items-center gap-16">
          <div>
            <SectionTitle eyebrow="How it works" title="Three quiet steps, every call." />
            <ol className="relative mt-12 space-y-10 pl-14">
              <span className="absolute bottom-2 left-[19px] top-2 w-0.5 rounded-full bg-line" aria-hidden="true" />
              <motion.span className="absolute bottom-2 left-[19px] top-2 w-0.5 origin-top rounded-full bg-accent" style={{ scaleY: fill }} aria-hidden="true" />
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative" aria-current={active === i ? "step" : undefined}>
                  <span
                    className={`absolute -left-14 flex h-10 w-10 items-center justify-center rounded-full ring-1 transition-colors duration-500 ${
                      i <= active ? "bg-accent text-accent-ink ring-accent" : "bg-surface text-ink-2 ring-line"
                    }`}
                  >
                    <s.icon size={18} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold tabular-nums text-ink-2">Step {i + 1}</div>
                    <h3 className={`text-xl font-semibold transition-colors duration-500 ${i === active ? "text-ink" : "text-ink-2"}`}>{s.title}</h3>
                    <p className="mt-1 text-base text-ink-2">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative h-[420px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="absolute inset-0 flex items-center"
              >
                <StepVisual i={active} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function StackedSteps() {
  return (
    <div className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-content">
        <SectionTitle eyebrow="How it works" title="Three quiet steps, every call." />
        <ol className="relative mt-12 space-y-12 pl-14">
          <span className="absolute bottom-2 left-[19px] top-2 w-0.5 rounded-full bg-line" aria-hidden="true" />
          {STEPS.map((s, i) => (
            <motion.li key={s.title} {...reveal(0.05)} className="relative">
              <span className="absolute -left-14 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-ink">
                <s.icon size={18} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <div className="text-xs font-semibold tabular-nums text-ink-2">Step {i + 1}</div>
              <h3 className="text-xl font-semibold">{s.title}</h3>
              <p className="mt-1 text-base text-ink-2">{s.body}</p>
              <div className="mt-6 max-w-md">
                <StepVisual i={i} />
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Small illustrative screens for each step. */
function StepVisual({ i }: { i: number }) {
  const card = "w-full rounded-card bg-surface p-6 shadow-lift ring-1 ring-line/70";
  if (i === 0)
    return (
      <div className={card} aria-hidden="true">
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Mic, label: "Live call" },
            { icon: FileAudio, label: "Recording" },
          ].map((o, k) => (
            <div key={o.label} className={`rounded-control p-4 ring-1 ${k === 0 ? "bg-accent-tint ring-accent/40" : "bg-subtle ring-line"}`}>
              <o.icon size={20} strokeWidth={1.5} className="text-accent" />
              <div className="mt-2 text-sm font-semibold">{o.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex h-14 items-center justify-between">
          {Array.from({ length: 32 }, (_, k) => (
            <span
              key={k}
              className="w-[3px] shrink-0 rounded-full bg-accent/50"
              style={{ height: `${30 + ((k * 37) % 70)}%`, animation: `wave ${1 + (k % 4) * 0.2}s ease-in-out ${k * 40}ms infinite` }}
            />
          ))}
        </div>
        <div className="mt-3 text-xs text-ink-2">Audio stays in memory and is never saved.</div>
      </div>
    );
  if (i === 1)
    return (
      <div className={card} aria-hidden="true">
        <p className="text-lg leading-relaxed">
          “Your parcel has <Mark>illegal items</Mark>. <Mark>Don't tell your family</Mark>, and <Mark>transfer the fine today</Mark>.”
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {["Threat", "Secrecy", "Payment"].map((t, k) => (
            <motion.span
              key={t}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.3 + k * 0.15 }}
              className="inline-flex items-center gap-1 rounded-full bg-risk-high-tint px-2.5 py-1 text-xs font-semibold text-ink"
            >
              <TriangleAlert size={12} strokeWidth={2} className="text-risk-high" />
              {t}
            </motion.span>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <span className="text-sm text-ink-2">Risk</span>
          <RiskBadge level="CRITICAL" />
        </div>
        <div className="mt-2 text-xs text-ink-2">Illustrative example</div>
      </div>
    );
  return (
    <div className={card} aria-hidden="true">
      <TinyFishSteps steps={SHOWCASE[0].steps} run />
    </div>
  );
}

function Mark({ children }: { children: ReactNode }) {
  return <span className="rounded-[4px] bg-risk-high-tint px-0.5 underline decoration-risk-high decoration-2 underline-offset-4">{children}</span>;
}

// ---------------------------------------------------------------- 5. truth check showcase

type Example = { title: string; said: string; truth: string; verdict: { label: string; icon: LucideIcon; cls: string }; steps: string[] };
const MISMATCH = { label: "Mismatch", icon: OctagonAlert, cls: "bg-risk-critical text-white" };
const SHOWCASE: Example[] = [
  {
    title: "Fake bank helpline",
    said: "“I'm calling from your bank's fraud team. Call me back on 98XXX XX310.”",
    truth: "That number isn't on the bank's official contact page. The official helpline is 1800-XXX-XXXX.",
    verdict: MISMATCH,
    steps: ["Finding the bank in the trusted directory", "Opening the official website", "Found the contact page", "Number mismatch"],
  },
  {
    title: "“Digital arrest”",
    said: "“This is the police. You are under digital arrest. Stay on video call and tell no one.”",
    truth: "Police don't arrest anyone over a video call. Official government advisories warn about exactly this.",
    verdict: { label: "Warning found", icon: Info, cls: "bg-accent text-accent-ink" },
    steps: ["Searching official government advisories", "Opening the advisory page", "Found a matching warning", "Advisory found"],
  },
  {
    title: "Fake courier link",
    said: "“Your parcel is held at customs. Pay the release fee at parcel-release.example.”",
    truth: "That link isn't the courier's official website, and public fraud reports mention it.",
    verdict: { label: "Reports found", icon: TriangleAlert, cls: "bg-risk-high text-white" },
    steps: ["Checking the courier's official website", "The link doesn't match", "Searching public fraud reports", "Reports found"],
  },
];

function TruthShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const { inView } = useLoop(ref, 7000, () => {
    if (!paused) setI((x) => (x + 1) % SHOWCASE.length);
  });
  const ex = SHOWCASE[i];
  return (
    <section id="truth" className="px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-content">
        <SectionTitle
          eyebrow="Truth check"
          title="What they said, next to what's true."
          body="Sentry sends TinyFish only the claim (an organisation name, a number, a UPI ID or a link) and checks it against official websites."
        />
        <div
          ref={ref}
          className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="relative min-h-[300px] rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-2">Illustrative example</div>
              <div className="flex gap-1" role="group" aria-label="Choose an example">
                {SHOWCASE.map((s, k) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => setI(k)}
                    aria-label={`Example ${k + 1}: ${s.title}`}
                    aria-pressed={k === i}
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${focusRing}`}
                  >
                    <span className={`h-2 rounded-full transition-all duration-300 ${k === i ? "w-5 bg-accent" : "w-2 bg-line"}`} />
                  </button>
                ))}
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.5, ease: EASE }}
                aria-live="polite"
              >
                <h3 className="mt-4 text-xl font-semibold">{ex.title}</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                  <div className="rounded-control bg-subtle p-4">
                    <div className="text-xs font-semibold text-ink-2">Caller said</div>
                    <p className="mt-1 text-base">{ex.said}</p>
                  </div>
                  <ArrowRight size={20} strokeWidth={1.5} className="mx-auto rotate-90 self-center text-ink-2 sm:rotate-0" aria-hidden="true" />
                  <div className="rounded-control bg-accent-tint p-4">
                    <div className="text-xs font-semibold text-ink-2">Truth</div>
                    <p className="mt-1 text-base">{ex.truth}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${ex.verdict.cls}`}>
                    <ex.verdict.icon size={16} strokeWidth={2} aria-hidden="true" />
                    {ex.verdict.label}
                  </span>
                  <span className="text-xs text-ink-2">checked just now · illustrative</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-8">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ScanSearch size={18} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
              TinyFish checking…
            </div>
            <div className="mt-5">
              <TinyFishSteps key={i} steps={ex.steps} run={inView} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Steps tick off one by one; the last one is the finding. */
function TinyFishSteps({ steps, run }: { steps: string[]; run: boolean }) {
  const reduce = useReducedMotion();
  const [done, setDone] = useState(reduce ? steps.length : 0);
  useEffect(() => {
    if (reduce) return setDone(steps.length);
    if (!run) return;
    setDone(0);
    const ids = steps.map((_, k) => window.setTimeout(() => setDone(k + 1), 700 + k * 850));
    return () => ids.forEach(window.clearTimeout);
  }, [run, reduce, steps]);
  return (
    <ol className="space-y-3.5">
      {steps.map((s, k) => {
        const finished = k < done;
        const current = k === done;
        return (
          <li key={s} className={`flex items-center gap-3 text-base transition-colors duration-300 ${finished || current ? "text-ink" : "text-ink-2"}`}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              {finished ? (
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3, ease: EASE }}>
                  <CircleCheck size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
                </motion.span>
              ) : current ? (
                <Spinner className="h-4 w-4 text-ink-2" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-line" />
              )}
            </span>
            <span className={k === steps.length - 1 && finished ? "font-semibold" : ""}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- 6. family protection

function Family() {
  const ref = useRef<HTMLDivElement>(null);
  const [beat, setBeat] = useState(0); // 0 quiet, 1 warning on Papa's phone, 2 alert arrives
  const { inView, reduce } = useLoop(ref, 7000, () => setBeat(0));
  useEffect(() => {
    if (reduce) return setBeat(2);
    if (!inView || beat !== 0) return;
    const a = window.setTimeout(() => setBeat(1), 700);
    const b = window.setTimeout(() => setBeat(2), 2200);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [inView, reduce, beat]);

  return (
    <section className="bg-subtle/60 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-content items-center gap-14 lg:grid-cols-2">
        <div>
          <SectionTitle
            eyebrow="Family protection"
            title="When it matters, the right person knows."
            body="If a call turns high-risk, Sentry can alert the one person you chose, and only if they've agreed. They never hear your calls or see recordings."
          />
          <motion.ul {...reveal(0.2)} className="mt-8 space-y-3 text-base">
            {["Consent-based: your contact confirms they agree", "One short alert per call, never a stream of messages", "You can change or remove your contact any time"].map((t) => (
              <li key={t} className="flex gap-3">
                <CircleCheck size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                {t}
              </li>
            ))}
          </motion.ul>
          <motion.p {...reveal(0.3)} className="mt-6 text-sm text-ink-2">
            Today alerts appear on the family dashboard; text and WhatsApp alerts are coming soon.
          </motion.p>
        </div>
        <div ref={ref} className="relative flex items-center justify-center gap-6 sm:gap-12" aria-hidden="true">
          <Phone label="Papa's phone">
            <AnimatePresence>
              {beat >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="rounded-[12px] bg-risk-high-tint p-3"
                >
                  <RiskBadge level="HIGH" />
                  <p className="mt-2 text-sm font-semibold leading-snug">This may be a scam.</p>
                  <p className="mt-1 text-xs leading-snug text-ink-2">Don't share any OTP. Hang up and call your bank's official number.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Phone>
          <svg className="absolute left-1/2 top-1/2 hidden h-6 w-16 -translate-x-1/2 -translate-y-1/2 sm:block" viewBox="0 0 64 24">
            <motion.path
              d="M2 12 H62"
              stroke="rgb(var(--accent))"
              strokeWidth="1.5"
              strokeDasharray="3 5"
              fill="none"
              initial={false}
              animate={{ pathLength: beat >= 2 ? 1 : 0, opacity: beat >= 2 ? 1 : 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            />
          </svg>
          <Phone label="Your phone">
            <AnimatePresence>
              {beat >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
                  className="rounded-[12px] bg-surface p-3 shadow-card ring-1 ring-line"
                >
                  <div className="flex items-center gap-1.5 text-xs text-ink-2">
                    <Logo className="h-4 w-4" />
                    {BRAND} · now
                  </div>
                  <p className="mt-1.5 text-sm font-semibold leading-snug">Possible scam call — check on Papa</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Phone>
        </div>
      </div>
    </section>
  );
}

function Phone({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="w-[150px] sm:w-[190px]">
      <div className="aspect-[9/18] rounded-[28px] bg-surface p-2 shadow-lift ring-1 ring-line">
        <div className="flex h-full flex-col rounded-[22px] bg-canvas p-3">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
          {children}
        </div>
      </div>
      <div className="mt-3 text-center text-xs font-medium text-ink-2">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------- 7. privacy

const PRIVACY: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: EyeOff, title: "Recordings not stored by default", body: "Audio is analysed in memory as it arrives and is never written to disk." },
  { icon: ScanSearch, title: "Only claims are checked, never your audio", body: "TinyFish receives an organisation name, number, UPI ID or link. Never audio, transcripts or your details." },
  { icon: BellRing, title: "Alerts only with consent", body: "Your trusted contact is alerted only if they've agreed, and you can remove them any time." },
];

function Privacy() {
  return (
    <section id="privacy" className="px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-content">
        <SectionTitle eyebrow="Privacy" title="Built to know as little about you as possible." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PRIVACY.map((p, i) => (
            <motion.div key={p.title} {...reveal(0.1 + i * 0.12)} className="rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-tint text-accent">
                <p.icon size={20} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-base text-ink-2">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- 8. final CTA + 9. footer

function FinalCta() {
  const reduce = useReducedMotion();
  const drift = (x: number, y: number, d: number) =>
    reduce ? {} : { animate: { x: [0, x, 0], y: [0, y, 0] }, transition: { duration: d, ease: "easeInOut" as const, repeat: Infinity } };
  return (
    <section className="px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="relative mx-auto max-w-content overflow-hidden rounded-card bg-accent-tint px-6 py-20 text-center sm:py-28">
        <motion.span {...drift(40, 20, 22)} className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/[0.06]" aria-hidden="true" />
        <motion.span {...drift(-30, -24, 26)} className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-accent/[0.05]" aria-hidden="true" />
        <motion.h2 {...reveal()} className="relative mx-auto max-w-2xl font-display text-3xl font-normal leading-[1.08] sm:text-4xl">
          Every call deserves a second opinion.
        </motion.h2>
        <motion.div {...reveal(0.15)} className="relative mt-10 flex justify-center">
          <AuthActions size="lg" />
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line px-4 py-12 sm:px-6">
      <div className="mx-auto flex max-w-content flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight">{BRAND}</span>
          </div>
          <p className="mt-2 max-w-xs text-sm text-ink-2">{TAGLINE}</p>
          <p className="mt-6 text-xs text-ink-2">Built for Kritical Hacks 2026 with TinyFish</p>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="Legal" className="flex gap-1">
            <a href="#privacy-policy" className={`rounded-control px-3 py-2 text-sm text-ink-2 hover:text-ink ${focusRing}`}>
              Privacy
            </a>
            <a href="#terms" className={`rounded-control px-3 py-2 text-sm text-ink-2 hover:text-ink ${focusRing}`}>
              Terms
            </a>
          </nav>
          <ThemeToggle />
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-content text-xs text-ink-2">
        <Info size={14} strokeWidth={1.5} className="mr-1 inline align-[-2px]" aria-hidden="true" />
        Examples on this page are illustrative. {BRAND} works on app and browser calls and uploaded recordings; it can't listen to ordinary phone calls.
      </p>
    </footer>
  );
}
