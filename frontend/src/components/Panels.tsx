import { CircleCheck, CircleDashed, CircleMinus, CircleX, Clock, Phone, ScanSearch, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { Alert, Entity, Hit, HealthComponent, Level, Reason, Risk, Utterance } from "../lib/types";
import Link from "./Link";
import { Card, RISK, RiskBadge, Skeleton, buttonClass } from "./ui";

// Live-call panels. Every value comes from backend events; absent values are shown as absent.

const TITLE = "text-sm font-semibold text-ink";
const TACTIC_LABEL: Record<string, string> = {
  AUTHORITY: "Authority",
  THREAT: "Threat",
  URGENCY: "Urgency",
  SECRECY: "Secrecy",
  ISOLATION: "Isolation",
  PAYMENT: "Payment",
  CREDENTIAL: "OTP / PIN",
};

// ---------------------------------------------------------------- health strip

const SHOWN = ["stt", "classifier", "lexicon", "voice", "verify", "alerts"] as const;
const LABEL: Record<string, string> = {
  stt: "Speech-to-text",
  classifier: "Classifier",
  lexicon: "Lexicon",
  voice: "Voice check",
  verify: "Verification",
  alerts: "Alerts",
};

function statusIcon(s: string) {
  if (s === "ok") return <CircleCheck size={14} strokeWidth={2} className="text-accent" aria-hidden="true" />;
  if (s === "loading") return <Clock size={14} strokeWidth={2} className="text-ink-2" aria-hidden="true" />;
  if (s === "disabled") return <CircleMinus size={14} strokeWidth={2} className="text-ink-2" aria-hidden="true" />;
  if (s === "degraded") return <CircleDashed size={14} strokeWidth={2} className="text-risk-medium" aria-hidden="true" />;
  return <CircleX size={14} strokeWidth={2} className="text-ink-2" aria-hidden="true" />; // unavailable, unconfigured, unreachable
}

/** Polls /health. Shows exactly what the backend reports; "unreachable" if it can't be asked. */
export function HealthStrip() {
  const [health, setHealth] = useState<Record<string, HealthComponent> | null>(null);
  const [overall, setOverall] = useState<string>("…");
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/health");
        const body = await res.json();
        if (alive) {
          setHealth(body.components);
          setOverall(body.status);
        }
      } catch {
        if (alive) {
          setHealth(null);
          setOverall("backend unreachable");
        }
      }
    };
    void poll();
    const id = window.setInterval(poll, 2000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);
  if (overall === "…")
    return (
      <div className="flex gap-2" aria-label="Checking system status">
        {SHOWN.map((n) => (
          <Skeleton key={n} className="h-7 w-24 rounded-full" />
        ))}
      </div>
    );
  return (
    <ul className="flex flex-wrap items-center gap-2 text-xs" aria-label={`System: ${overall}`}>
      <li className="mr-1 font-semibold text-ink-2">System: {overall}</li>
      {SHOWN.map((name) => {
        const c = health?.[name];
        const status = c?.status ?? "unreachable";
        return (
          <li
            key={name}
            className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 ring-1 ring-line"
            title={c?.detail ?? "no answer from backend"}
          >
            {statusIcon(status)}
            <span className="font-medium text-ink">{LABEL[name]}</span>
            <span className="text-ink-2">{status}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- risk meter + chart

const R = 84;
const CIRC = 2 * Math.PI * R;
const THRESHOLDS = [0.3, 0.55, 0.8];

/** The hero of the live screen: a ring that fills smoothly as the score changes. */
export function RiskMeter({ risk, listening }: { risk: Risk | null; listening: boolean }) {
  const score = risk?.score ?? 0;
  const latest = risk?.top_reasons[0];
  return (
    <Card className={`p-6 transition-colors duration-500 sm:p-8 ${risk ? RISK[risk.level].tint : ""}`} aria-labelledby="risk-h">
      <div className="flex items-center justify-between">
        <h2 id="risk-h" className={TITLE}>
          Risk right now
        </h2>
        {risk && <RiskBadge level={risk.level} />}
      </div>
      <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="relative h-48 w-48 shrink-0">
          <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="100" cy="100" r={R} fill="none" stroke="rgb(var(--line))" strokeWidth="12" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={risk ? RISK[risk.level].stroke : "transparent"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - score)}
              style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1), stroke 400ms ease-out" }}
            />
            {THRESHOLDS.map((t) => (
              <line
                key={t}
                x1={100 + (R - 9) * Math.cos(2 * Math.PI * t)}
                y1={100 + (R - 9) * Math.sin(2 * Math.PI * t)}
                x2={100 + (R + 9) * Math.cos(2 * Math.PI * t)}
                y2={100 + (R + 9) * Math.sin(2 * Math.PI * t)}
                stroke="rgb(var(--ink-2))"
                strokeWidth="2"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {risk ? (
              <>
                <span className="text-3xl font-semibold tabular-nums">{Math.round(score * 100)}</span>
                <span className="text-xs text-ink-2">score / 100</span>
              </>
            ) : (
              <span className="px-6 text-center text-sm text-ink-2">{listening ? "Waiting for speech…" : "Not listening"}</span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1" aria-live="polite">
          {latest ? (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-2">Latest warning</div>
              <p className="mt-1 text-lg font-semibold leading-snug">{latest.en}</p>
              <p className="mt-1 text-base text-ink-2">{latest.hi}</p>
              {latest.evidence_text && <p className="mt-3 text-sm italic text-ink-2">“{latest.evidence_text}”</p>}
            </>
          ) : (
            <p className="text-base text-ink-2">
              {risk ? "No warning signs so far." : "Start listening or analyse a recording. The meter moves only when speech has been analysed."}
            </p>
          )}
        </div>
      </div>
      <p className="mt-6 text-xs tabular-nums text-ink-2">Low &lt; 30 · Medium &lt; 55 · High &lt; 80 · Critical</p>
    </Card>
  );
}

export function RiskChart({ history }: { history: { t: number; score: number; level: Level }[] }) {
  const W = 600;
  const H = 160;
  const tMax = Math.max(30, ...history.map((p) => p.t));
  const x = (t: number) => (t / tMax) * W;
  const y = (s: number) => H - s * H;
  const path = history.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  const last = history[history.length - 1];
  return (
    <Card className="p-6" aria-labelledby="chart-h">
      <h2 id="chart-h" className={`${TITLE} mb-3`}>
        Risk over the call
      </h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label={last ? `Latest score ${Math.round(last.score * 100)} of 100, ${RISK[last.level].label}` : "No scores yet"}>
        {THRESHOLDS.map((v) => (
          <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="rgb(var(--line))" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
        ))}
        {history.length > 0 && <path d={path} fill="none" stroke="rgb(var(--accent))" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
        {history.map((p, i) => (
          <circle key={i} cx={x(p.t)} cy={y(p.score)} r={4} fill={RISK[p.level].stroke} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-ink-2">
        <span>0 s</span>
        <span>{Math.round(tMax)} s</span>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- tactic chain

const CHAIN = [
  { stage: 1, label: "Authority", sub: "claims to be an official" },
  { stage: 2, label: "Threat", sub: "threat or urgency" },
  { stage: 3, label: "Secrecy", sub: "secrecy or isolation" },
  { stage: 4, label: "Payment", sub: "money or OTP demand" },
];

export function TacticChain({ stages, chainTactics }: { stages: number[]; chainTactics: Record<number, string[]> }) {
  return (
    <Card className="p-6" aria-labelledby="chain-h">
      <h2 id="chain-h" className={`${TITLE} mb-4`}>
        Scam pattern
      </h2>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CHAIN.map((c) => {
          const on = stages.includes(c.stage);
          return (
            <li
              key={c.stage}
              className={`rounded-control p-3 transition-colors duration-500 ${on ? "bg-risk-high-tint ring-1 ring-inset ring-risk-high/40" : "bg-subtle"}`}
            >
              <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                {on ? (
                  <TriangleAlert size={16} strokeWidth={2} className="text-risk-high" aria-hidden="true" />
                ) : (
                  <span className="text-xs tabular-nums text-ink-2" aria-hidden="true">
                    {c.stage}
                  </span>
                )}
                {c.label}
                <span className="sr-only">{on ? ": heard" : ": not heard"}</span>
              </div>
              <div className="mt-1 text-xs text-ink-2">
                {on ? (chainTactics[c.stage] ?? []).map((t) => TACTIC_LABEL[t] ?? t).join(" + ") : c.sub}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// ---------------------------------------------------------------- transcript

function highlight(text: string, hits: Hit[]) {
  // Mark every tactic span that is a real part of the text (not a whole-utterance model span).
  const ranges: { start: number; end: number; tactic: string }[] = [];
  for (const h of hits) {
    if (h.negated || !h.span || h.span === text) continue;
    const start = text.indexOf(h.span);
    if (start >= 0) ranges.push({ start, end: start + h.span.length, tactic: h.tactic });
  }
  ranges.sort((a, b) => a.start - b.start);
  const out: JSX.Element[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue; // overlapping: keep the first
    if (r.start > pos) out.push(<span key={`t${pos}`}>{text.slice(pos, r.start)}</span>);
    out.push(
      <mark
        key={`h${r.start}`}
        className="rounded-[4px] bg-risk-high-tint px-0.5 text-ink underline decoration-risk-high decoration-2 underline-offset-4"
        title={TACTIC_LABEL[r.tactic] ?? r.tactic}
      >
        {text.slice(r.start, r.end)}
        <span className="sr-only"> (red flag: {TACTIC_LABEL[r.tactic] ?? r.tactic})</span>
      </mark>,
    );
    pos = r.end;
  }
  if (pos < text.length) out.push(<span key={`t${pos}`}>{text.slice(pos)}</span>);
  return out;
}

export function Transcript({ utterances, hits }: { utterances: Utterance[]; hits: Record<string, Hit[]> }) {
  return (
    <Card className="p-6" aria-labelledby="tr-h">
      <h2 id="tr-h" className={`${TITLE} mb-4`}>
        Transcript <span className="font-normal text-ink-2">· newest first</span>
      </h2>
      {utterances.length === 0 && <p className="py-6 text-center text-base text-ink-2">Waiting for speech…</p>}
      <ol className="max-h-[34rem] overflow-y-auto pr-1">
        {utterances.map((u) => {
          const h = hits[u.utterance_id] ?? [];
          const tactics = [...new Set(h.filter((x) => x.counted && x.score > 0).map((x) => x.tactic))];
          return (
            <li key={u.utterance_id} className="grid animate-step grid-cols-[3.5rem_1fr] gap-3 border-l border-line pb-5 pl-0 last:pb-0">
              <div className="relative -ml-px pt-0.5 text-right text-xs tabular-nums text-ink-2">
                <span className={`absolute -left-[4.5px] top-2 h-2 w-2 rounded-full ${tactics.length ? "bg-risk-high" : "bg-line"}`} aria-hidden="true" />
                {u.t_start_s.toFixed(1)} s
              </div>
              <div className="min-w-0">
                {u.stt_status === "ok" && u.text ? (
                  <p className="text-lg leading-relaxed">{highlight(u.text, h)}</p>
                ) : (
                  <p className="text-base italic text-ink-2">
                    Speech not transcribed: {u.stt_status}
                    {u.detail ? ` (${u.detail})` : ""}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                  {tactics.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-risk-high-tint px-2 py-0.5 font-semibold text-ink">
                      <TriangleAlert size={12} strokeWidth={2} className="text-risk-high" aria-hidden="true" />
                      {TACTIC_LABEL[t] ?? t}
                    </span>
                  ))}
                  {u.lang && <span>{u.lang}</span>}
                  {u.stt_latency_ms != null && <span className="tabular-nums">· STT {(u.stt_latency_ms / 1000).toFixed(1)} s</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// ---------------------------------------------------------------- why, claims, alert

export function WhyPanel({ reasons, mode }: { reasons: Reason[]; mode: string | null }) {
  return (
    <Card className="p-6" aria-labelledby="why-h">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="why-h" className={TITLE}>
          Why
        </h2>
        {mode && <span className="text-xs text-ink-2">{mode === "model" ? "classifier" : "lexicon fallback (classifier unavailable)"}</span>}
      </div>
      {reasons.length === 0 && <p className="text-base text-ink-2">No warning signs yet.</p>}
      <ol className="space-y-4">
        {reasons.map((r, i) => (
          <li key={`${r.code}${i}`} className="border-l-2 border-risk-high/50 pl-3">
            <div className="text-base font-semibold">{r.en}</div>
            <div className="text-base text-ink-2">{r.hi}</div>
            {r.evidence_text && <div className="mt-1 text-sm italic text-ink-2">“{r.evidence_text}”</div>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

const CLAIM_KIND: Record<string, string> = {
  institution: "Claims to be",
  phone: "Number given",
  upi: "UPI ID given",
  url: "Link given",
  case_id: "Case number",
};

function claimLabel(e: Entity): string {
  return `${CLAIM_KIND[e.kind] ?? e.kind}: ${e.value}`;
}

/** What the caller has claimed so far. Live calls don't run TinyFish checks yet, so this says so
 *  and points to the manual check instead of showing a verification that didn't happen. */
export function ClaimsPanel({ claims, verify }: { claims: Entity[]; verify: string | null }) {
  return (
    <Card className="p-6" aria-labelledby="claims-h">
      <h2 id="claims-h" className={`${TITLE} mb-3`}>
        Is this true?
      </h2>
      {claims.length === 0 ? (
        <p className="text-base text-ink-2">No claims heard yet (organisation names, numbers, UPI IDs, links).</p>
      ) : (
        <ul className="divide-y divide-line">
          {claims.map((c) => (
            <li key={`${c.kind}${c.value}`} className="flex justify-between gap-4 py-2.5 text-sm">
              <span className="text-ink-2">{CLAIM_KIND[c.kind] ?? c.kind}</span>
              <span className="truncate font-medium tabular-nums">{c.value}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-ink-2">
        Live checks against official sources aren't connected to calls yet{verify ? ` (verification: ${verify})` : ""}. Check these claims yourself in
        a few seconds:
      </p>
      <Link to="/check" className={`${buttonClass("secondary")} mt-3`}>
        <ScanSearch size={18} strokeWidth={1.5} aria-hidden="true" />
        Check a caller
      </Link>
    </Card>
  );
}

export function AlertPanel({ alert }: { alert: Alert }) {
  const r = RISK[alert.level];
  return (
    <section className={`rounded-card p-6 ring-1 ring-inset ring-line sm:p-8 ${r.tint}`} role="alert" aria-labelledby="alert-h">
      <div className="flex flex-wrap items-center gap-3">
        <RiskBadge level={alert.level} size="lg" />
        <span className="text-sm font-semibold text-ink-2">Family alert sent</span>
      </div>
      <h2 id="alert-h" className="mt-4 text-2xl font-semibold">
        {alert.title.en}
      </h2>
      <p className="mt-1 text-xl text-ink">{alert.title.hi}</p>
      <div className="mt-5 inline-flex items-center gap-3 rounded-control bg-surface px-5 py-3 text-lg font-semibold shadow-card">
        <Phone size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
        {alert.action.en} · {alert.action.hi}
      </div>
      {alert.claims.length > 0 && (
        <ul className="mt-5 space-y-1 text-base">
          {alert.claims.map((c) => (
            <li key={`${c.kind}${c.value}`}>{claimLabel(c)}</li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-ink-2">
        {alert.verified_official_number ? `Official number: ${alert.verified_official_number}` : `Official number check: ${alert.verification_status}`}
      </p>
    </section>
  );
}
