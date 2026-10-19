import { useEffect, useState } from "react";
import { LEVEL_STYLE, TACTIC_STYLE } from "../lib/state";
import type { Alert, Entity, Hit, HealthComponent, Level, Reason, Risk, Utterance } from "../lib/types";

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

function statusColor(s: string): string {
  if (s === "ok") return "bg-emerald-500";
  if (s === "loading") return "bg-sky-500 animate-pulse";
  if (s === "degraded") return "bg-amber-500";
  if (s === "disabled") return "bg-slate-500";
  return "bg-red-500"; // unavailable, unconfigured, unreachable
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
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-lg">
      <span className="font-semibold text-slate-300">System: {overall}</span>
      {SHOWN.map((name) => {
        const c = health?.[name];
        const status = c?.status ?? "unreachable";
        return (
          <span key={name} className="flex items-center gap-2" title={c?.detail ?? "no answer from backend"}>
            <span className={`inline-block h-3.5 w-3.5 rounded-full ${statusColor(status)}`} />
            <span className="text-slate-300">{LABEL[name]}</span>
            <span className="text-slate-400">{status}</span>
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- risk meter + chart

export function RiskMeter({ risk }: { risk: Risk | null }) {
  if (!risk) {
    return (
      <div className="rounded-3xl bg-slate-900 p-8 ring-2 ring-slate-700">
        <div className="text-2xl text-slate-400">Risk</div>
        <div className="mt-2 text-5xl font-bold text-slate-500">no speech analysed yet</div>
      </div>
    );
  }
  const st = LEVEL_STYLE[risk.level];
  const pct = Math.round(risk.score * 100);
  return (
    <div className={`rounded-3xl bg-slate-900 p-8 ring-4 ${st.ring}`}>
      <div className="flex items-baseline justify-between">
        <div className="text-2xl text-slate-300">Risk</div>
        <div className="text-xl text-slate-400">score {risk.score.toFixed(2)}</div>
      </div>
      <div className={`mt-1 text-7xl font-black tracking-tight ${st.text}`}>{risk.level}</div>
      <div className="mt-6 h-6 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${st.bg} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-sm text-slate-500">
        <span>LOW</span>
        <span>MEDIUM 0.30</span>
        <span>HIGH 0.55</span>
        <span>CRITICAL 0.80</span>
      </div>
    </div>
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
    <div className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-700">
      <div className="mb-2 text-xl text-slate-300">Risk over the call</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none">
        {[0.3, 0.55, 0.8].map((v) => (
          <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="#334155" strokeDasharray="6 6" />
        ))}
        {history.length > 0 && (
          <path d={path} fill="none" stroke={LEVEL_STYLE[last.level].stroke} strokeWidth={4} />
        )}
        {history.map((p, i) => (
          <circle key={i} cx={x(p.t)} cy={y(p.score)} r={5} fill={LEVEL_STYLE[p.level].stroke} />
        ))}
      </svg>
      <div className="flex justify-between text-sm text-slate-500">
        <span>0 s</span>
        <span>{Math.round(tMax)} s</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tactic chain

const CHAIN = [
  { stage: 1, label: "AUTHORITY", sub: "claims to be an official" },
  { stage: 2, label: "THREAT", sub: "threat or urgency" },
  { stage: 3, label: "SECRECY", sub: "secrecy or isolation" },
  { stage: 4, label: "PAYMENT", sub: "money or OTP demand" },
];

export function TacticChain({ stages, chainTactics }: { stages: number[]; chainTactics: Record<number, string[]> }) {
  return (
    <div className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-700">
      <div className="mb-4 text-xl text-slate-300">Scam pattern</div>
      <div className="flex items-stretch gap-3">
        {CHAIN.map((c, i) => {
          const on = stages.includes(c.stage);
          return (
            <div key={c.stage} className="flex flex-1 items-center gap-3">
              <div
                className={`flex-1 rounded-2xl p-4 text-center transition-all duration-500 ${
                  on ? "bg-red-600 text-white shadow-lg shadow-red-900" : "bg-slate-800 text-slate-500"
                }`}
              >
                <div className="text-2xl font-bold">{c.label}</div>
                <div className="text-base">{on ? (chainTactics[c.stage] ?? []).join(" + ") : c.sub}</div>
              </div>
              {i < CHAIN.length - 1 && <div className="text-3xl text-slate-500">→</div>}
            </div>
          );
        })}
      </div>
    </div>
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
      <mark key={`h${r.start}`} className={`rounded-md px-1 ring-1 ${TACTIC_STYLE[r.tactic] ?? ""}`} title={r.tactic}>
        {text.slice(r.start, r.end)}
      </mark>,
    );
    pos = r.end;
  }
  if (pos < text.length) out.push(<span key={`t${pos}`}>{text.slice(pos)}</span>);
  return out;
}

export function Transcript({ utterances, hits }: { utterances: Utterance[]; hits: Record<string, Hit[]> }) {
  return (
    <div className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-700">
      <div className="mb-3 text-xl text-slate-300">Live transcript, newest first</div>
      {utterances.length === 0 && <div className="text-2xl text-slate-500">Waiting for speech…</div>}
      <ul className="max-h-[34rem] space-y-4 overflow-y-auto pr-2">
        {utterances.map((u) => {
          const h = hits[u.utterance_id] ?? [];
          const tactics = [...new Set(h.filter((x) => x.counted && x.score > 0).map((x) => x.tactic))];
          return (
            <li key={u.utterance_id} className="rounded-2xl bg-slate-800/60 p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                <span>{u.t_start_s.toFixed(1)} s</span>
                {u.lang && <span>· {u.lang}</span>}
                {u.stt_latency_ms != null && <span>· STT {(u.stt_latency_ms / 1000).toFixed(1)} s</span>}
                {tactics.map((t) => (
                  <span key={t} className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${TACTIC_STYLE[t] ?? ""}`}>
                    {t}
                  </span>
                ))}
              </div>
              {u.stt_status === "ok" && u.text ? (
                <div className="text-2xl leading-relaxed">{highlight(u.text, h)}</div>
              ) : (
                <div className="text-xl italic text-amber-400">
                  speech not transcribed: {u.stt_status}
                  {u.detail ? ` (${u.detail})` : ""}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- why + alert

export function WhyPanel({ reasons, mode }: { reasons: Reason[]; mode: string | null }) {
  return (
    <div className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-700">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-xl text-slate-300">Why</div>
        {mode && (
          <div className={`text-sm ${mode === "model" ? "text-slate-400" : "text-amber-400"}`}>
            {mode === "model" ? "classifier" : "lexicon fallback (classifier unavailable)"}
          </div>
        )}
      </div>
      {reasons.length === 0 && <div className="text-xl text-slate-500">No warning signs yet.</div>}
      <ol className="space-y-4">
        {reasons.map((r, i) => (
          <li key={`${r.code}${i}`}>
            <div className="text-2xl font-semibold">{r.en}</div>
            <div className="text-2xl text-slate-300">{r.hi}</div>
            {r.evidence_text && <div className="mt-1 text-lg italic text-slate-400">“{r.evidence_text}”</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function claimLabel(e: Entity): string {
  const kinds: Record<string, string> = {
    institution: "Claims to be",
    phone: "Number given",
    upi: "UPI ID given",
    url: "Link given",
    case_id: "Case number",
  };
  return `${kinds[e.kind] ?? e.kind}: ${e.value}`;
}

export function AlertPanel({ alert }: { alert: Alert }) {
  const critical = alert.level === "CRITICAL";
  return (
    <div className={`rounded-3xl p-8 text-white ring-4 ${critical ? "bg-red-700 ring-red-300 animate-pulse" : "bg-orange-700 ring-orange-300"}`}>
      <div className="text-lg uppercase tracking-widest opacity-90">Family alert sent · {alert.level}</div>
      <div className="mt-2 text-4xl font-black">{alert.title.en}</div>
      <div className="text-3xl font-bold opacity-95">{alert.title.hi}</div>
      <div className="mt-5 inline-block rounded-2xl bg-white px-6 py-3 text-3xl font-black text-slate-900">
        📞 {alert.action.en} · {alert.action.hi}
      </div>
      {alert.claims.length > 0 && (
        <ul className="mt-5 space-y-1 text-xl">
          {alert.claims.map((c) => (
            <li key={`${c.kind}${c.value}`}>• {claimLabel(c)}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 text-lg opacity-90">
        {alert.verified_official_number
          ? `Official number: ${alert.verified_official_number}`
          : `Official number check: ${alert.verification_status}`}
      </div>
    </div>
  );
}
