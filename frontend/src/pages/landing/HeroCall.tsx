import { BadgeCheck, OctagonAlert, Phone, ScanSearch } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { RISK, RiskBadge } from "../../components/ui";
import { EASE } from "../../lib/brand";
import type { Level } from "../../lib/types";

// The hero's ~10 s story, illustrative only: a call comes in, the caller's words are transcribed,
// pressure tactics get underlined, risk rises, and a truth check lands. Transform + opacity only;
// it pauses when off screen and shows the final frame with reduced motion.

const LINES = [
  { pre: "", phrase: "This is SBI", post: ".", tag: "Authority" },
  { pre: "Your ", phrase: "account is blocked", post: ".", tag: "Urgency" },
  { pre: "", phrase: "Share the OTP", post: " now.", tag: "OTP request" },
];
// Timeline in ms from the start of a cycle.
const T = { wave: 500, line: [900, 1900, 3200], mark: [4400, 5000, 5600], truth: 6700, end: 9600, restart: 10300 };
const RISK_AT: { level: Level; value: number }[] = [
  { level: "LOW", value: 0.08 },
  { level: "LOW", value: 0.22 },
  { level: "MEDIUM", value: 0.46 },
  { level: "HIGH", value: 0.74 },
];
const CHAR_MS = 38;
const FINAL = 1_000_000; // "everything has happened"

export default function HeroCall() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [cycle, setCycle] = useState(0);
  const [t, setT] = useState(reduce ? FINAL : 0);

  useEffect(() => {
    if (reduce) {
      setT(FINAL);
      return;
    }
    if (!inView) return;
    // Discrete clock: one state update per story beat, not per frame.
    const beats = [0, T.wave, ...T.line, ...T.mark, T.truth, T.end];
    setT(0);
    const ids = beats.map((b) => window.setTimeout(() => setT(b), b));
    ids.push(window.setTimeout(() => setCycle((c) => c + 1), T.restart));
    return () => ids.forEach(window.clearTimeout);
  }, [cycle, inView, reduce]);

  const marks = T.mark.filter((m) => t >= m).length;
  const risk = RISK_AT[marks];
  const ending = t >= T.end && t !== FINAL;

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[460px] pb-24" aria-hidden="true">
      <motion.div key={cycle} animate={{ opacity: ending ? 0 : 1 }} transition={{ duration: 0.6, ease: EASE }}>
        {/* Call card */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="rounded-card bg-surface p-5 shadow-lift ring-1 ring-line/70 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-tint text-accent">
              <Phone size={20} strokeWidth={1.5} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">Incoming call · Unknown number</div>
              <div className="text-xs tabular-nums text-ink-2">+91 9XXXX XXX21</div>
            </div>
            <span className="rounded-full bg-subtle px-2 py-0.5 text-xs text-ink-2">Illustrative</span>
          </div>

          <Waveform active={t >= T.wave && t !== FINAL} />

          <div className="min-h-[7.5rem] space-y-2.5 text-[17px] leading-snug text-ink">
            {LINES.map((l, i) => (
              <Line key={i} line={l} start={t >= T.line[i]} marked={t >= T.mark[i]} reduce={!!reduce} />
            ))}
          </div>

          {/* Risk meter */}
          <div className="mt-5 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-2">Risk</span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={risk.level}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <RiskBadge level={risk.level} />
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-subtle">
              {(["LOW", "MEDIUM", "HIGH"] as Level[]).map((lv) => (
                <motion.div
                  key={lv}
                  className={`absolute inset-0 origin-left rounded-full ${RISK[lv].solid}`}
                  initial={false}
                  animate={{ scaleX: risk.value, opacity: risk.level === lv ? 1 : 0 }}
                  transition={{ duration: 0.9, ease: EASE }}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Truth check */}
        <AnimatePresence>
          {t >= T.truth && (
            <motion.div
              initial={reduce ? false : { opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: EASE }}
              className="absolute -bottom-2 left-4 right-0 rounded-card bg-surface p-4 shadow-lift ring-1 ring-line sm:-right-10 sm:left-14"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-2">
                <ScanSearch size={14} strokeWidth={2} className="text-accent" />
                Truth check
              </div>
              <div className="mt-2.5 flex items-start gap-2 text-sm text-ink">
                <OctagonAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-risk-critical" />
                <span>
                  <span className="text-ink-2">Caller's number:</span> <strong className="font-semibold">not SBI's official number</strong>
                </span>
              </div>
              <div className="mt-1.5 flex items-start gap-2 text-sm text-ink">
                <BadgeCheck size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-accent" />
                <span>
                  <span className="text-ink-2">Official:</span> <span className="font-semibold tabular-nums">1800-XXX-XXXX</span>
                  <span className="text-ink-2"> · sbi.co.in</span>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = [0.3, 0.5, 0.8, 0.6, 1, 0.7, 0.45, 0.85, 0.55, 0.35, 0.65, 0.9, 0.5, 0.3, 0.6, 0.8, 0.4, 0.7, 0.5, 0.3, 0.55, 0.75, 0.4, 0.25];
  return (
    <div className="my-5 flex h-10 items-center justify-between">
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] shrink-0 rounded-full transition-colors duration-500 ${active ? "bg-accent/60" : "bg-line"} ${i > 17 ? "hidden sm:block" : ""}`}
          style={{
            height: `${h * 100}%`,
            animation: active ? `wave ${0.9 + (i % 4) * 0.15}s ease-in-out ${i * 45}ms infinite` : undefined,
            transform: active ? undefined : "scaleY(0.25)",
            transition: "transform 500ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      ))}
    </div>
  );
}

function Line({ line, start, marked, reduce }: { line: (typeof LINES)[number]; start: boolean; marked: boolean; reduce: boolean }) {
  const full = line.pre + line.phrase + line.post;
  const [n, setN] = useState(reduce ? full.length : 0);
  useEffect(() => {
    if (reduce) return setN(full.length);
    if (!start) return setN(0);
    const id = window.setInterval(() => setN((c) => (c >= full.length ? c : c + 1)), CHAR_MS);
    return () => window.clearInterval(id);
  }, [start, reduce, full.length]);

  if (!start && !reduce) return <p className="h-6" />;
  const a = line.pre.length;
  const b = a + line.phrase.length;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>
        <span className="text-ink-2">“</span>
        {full.slice(0, Math.min(n, a))}
        <span className="relative">
          {full.slice(a, Math.max(a, Math.min(n, b)))}
          <motion.span
            className="absolute -bottom-0.5 left-0 right-0 h-[2px] origin-left rounded-full bg-risk-high"
            initial={false}
            animate={{ scaleX: marked ? 1 : 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          />
        </span>
        {full.slice(b, Math.max(b, n))}
        {n >= full.length && <span className="text-ink-2">”</span>}
      </span>
      <AnimatePresence>
        {marked && (
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="rounded-full bg-risk-high-tint px-2 py-0.5 text-xs font-semibold text-ink"
          >
            {line.tag}
          </motion.span>
        )}
      </AnimatePresence>
    </p>
  );
}
