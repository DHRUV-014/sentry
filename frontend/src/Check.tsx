import { useState } from "react";
import type { Level } from "./lib/types";

type Lang = "en" | "hi";
type Bi = { en: string; hi: string };

interface Source {
  url: string;
  title: string;
  snippet: string;
  fetched_at: string;
}
interface CheckResult {
  check: "institution_contact" | "advisory" | "public_reports";
  input: Record<string, string>;
  verdict: string;
  status: "ok" | "unavailable" | "skipped";
  official_contact: string | null;
  sources: Source[];
  latency_ms: number;
  cached: boolean;
  fetched_at: string | null;
  confidence: string | null;
  note: Bi;
}
interface Response {
  level: Level;
  score: number;
  tactics: string[];
  top_reasons: (Bi & { code: string })[];
  checks: CheckResult[];
  text_analysis: { label: Bi; mode: string; tactics: string[] } | null;
  next_steps: Bi[];
  verification_status: string;
  verification_capped: boolean;
}

const T = {
  title: { en: "Check this caller", hi: "इस कॉल करने वाले की जाँच करें" },
  intro: {
    en: "Tell us what the caller said. We check official websites and tell you what to do.",
    hi: "बताइए कॉल करने वाले ने क्या कहा। हम आधिकारिक वेबसाइटें जाँचकर बताएँगे कि क्या करें।",
  },
  who: { en: "Who did they say they are?", hi: "उन्होंने खुद को कौन बताया?" },
  name: { en: "Name of the bank / office / company", hi: "बैंक / दफ़्तर / कंपनी का नाम" },
  namePh: { en: "e.g. HDFC Bank, CBI, Blue Dart", hi: "जैसे HDFC Bank, CBI, Blue Dart" },
  phone: { en: "Number they called from", hi: "जिस नंबर से कॉल आया" },
  upi: { en: "UPI ID they gave (optional)", hi: "उन्होंने जो यूपीआई आईडी दी (वैकल्पिक)" },
  url: { en: "Website or link they gave (optional)", hi: "उन्होंने जो वेबसाइट या लिंक दिया (वैकल्पिक)" },
  asked: { en: "What did they ask you to do?", hi: "उन्होंने आपसे क्या करने को कहा?" },
  message: {
    en: "Paste their message (optional, experimental)",
    hi: "उनका संदेश यहाँ चिपकाएँ (वैकल्पिक, प्रायोगिक)",
  },
  submit: { en: "Check now", hi: "अभी जाँचें" },
  checking: { en: "Checking official sources…", hi: "आधिकारिक स्रोत जाँचे जा रहे हैं…" },
  steps: { en: "What to do now", hi: "अब क्या करें" },
  why: { en: "Why", hi: "क्यों" },
  official: { en: "Official number", hi: "आधिकारिक नंबर" },
  sources: { en: "Sources", hi: "स्रोत" },
  cached: { en: "cached, fetched at", hi: "पहले से सहेजा गया, लिया गया" },
  unavailable: {
    en: "Online checks are unavailable right now. The advice below is based only on what you told us.",
    hi: "ऑनलाइन जाँच अभी उपलब्ध नहीं है। नीचे की सलाह सिर्फ़ आपकी बताई बातों पर आधारित है।",
  },
  risk: { en: "Risk", hi: "खतरा" },
  lowConf: { en: "low confidence", hi: "कम भरोसेमंद" },
} satisfies Record<string, Bi>;

const TYPES: [string, Bi][] = [
  ["bank", { en: "Bank", hi: "बैंक" }],
  ["police", { en: "Police / CBI", hi: "पुलिस / सीबीआई" }],
  ["government", { en: "Government office", hi: "सरकारी दफ़्तर" }],
  ["courier", { en: "Courier", hi: "कूरियर" }],
  ["telecom", { en: "Mobile company", hi: "मोबाइल कंपनी" }],
  ["company", { en: "Other company", hi: "दूसरी कंपनी" }],
  ["relative", { en: "Relative / friend", hi: "रिश्तेदार / दोस्त" }],
  ["other", { en: "Someone else", hi: "कोई और" }],
];
const ASKS: [string, Bi][] = [
  ["otp", { en: "Tell an OTP / PIN", hi: "ओटीपी / पिन बताना" }],
  ["money", { en: "Send money", hi: "पैसे भेजना" }],
  ["video_call", { en: "Join a video call", hi: "वीडियो कॉल पर आना" }],
  ["secrecy", { en: "Keep it secret", hi: "बात छिपाकर रखना" }],
  ["install_app", { en: "Install an app", hi: "कोई ऐप डालना" }],
  ["go_alone", { en: "Go somewhere alone", hi: "अकेले कहीं जाना" }],
];
const CHECK_TITLE: Record<string, Bi> = {
  institution_contact: { en: "Official phone number", hi: "आधिकारिक फ़ोन नंबर" },
  advisory: { en: "Government warnings", hi: "सरकारी चेतावनियाँ" },
  public_reports: { en: "Public fraud reports", hi: "धोखाधड़ी की सार्वजनिक शिकायतें" },
};
const VERDICT_STYLE: Record<string, string> = {
  MISMATCH: "bg-red-600",
  REPORTS_FOUND: "bg-orange-600",
  ADVISORY_FOUND: "bg-sky-700",
  MATCH: "bg-emerald-700",
  NO_REPORTS_FOUND: "bg-slate-600",
  UNKNOWN: "bg-slate-600",
  UNAVAILABLE: "bg-slate-700",
};
const VERDICT_LABEL: Record<string, Bi> = {
  MATCH: { en: "MATCH", hi: "नंबर सही" },
  MISMATCH: { en: "MISMATCH", hi: "नंबर मेल नहीं खाता" },
  UNKNOWN: { en: "UNKNOWN", hi: "पता नहीं" },
  ADVISORY_FOUND: { en: "ADVISORY FOUND", hi: "चेतावनी मिली" },
  REPORTS_FOUND: { en: "REPORTS FOUND", hi: "शिकायतें मिलीं" },
  NO_REPORTS_FOUND: { en: "NO REPORTS FOUND", hi: "कोई शिकायत नहीं मिली" },
  UNAVAILABLE: { en: "UNAVAILABLE", hi: "उपलब्ध नहीं" },
};
const LEVEL_BG: Record<Level, string> = {
  LOW: "bg-emerald-700",
  MEDIUM: "bg-amber-600",
  HIGH: "bg-orange-600",
  CRITICAL: "bg-red-700",
};
const LEVEL_TEXT: Record<Level, Bi> = {
  LOW: { en: "Low risk", hi: "कम खतरा" },
  MEDIUM: { en: "Be careful", hi: "सावधान रहें" },
  HIGH: { en: "Likely a scam", hi: "शायद धोखाधड़ी" },
  CRITICAL: { en: "Scam: stop now", hi: "धोखाधड़ी: अभी रुकें" },
};

const input = "w-full rounded-2xl bg-slate-800 px-5 py-4 text-2xl text-white ring-2 ring-slate-600 focus:ring-sky-400 focus:outline-none";

export default function Check() {
  const [lang, setLang] = useState<Lang>("en");
  const [type, setType] = useState("bank");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [upi, setUpi] = useState("");
  const [url, setUrl] = useState("");
  const [asked, setAsked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<Response | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const t = (b: Bi) => b[lang];

  const submit = async () => {
    setBusy(true);
    setError("");
    setRes(null);
    const t0 = performance.now();
    try {
      const r = await fetch("/verify/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimed_identity_type: type,
          claimed_identity_name: name,
          phone: phone || null,
          upi: upi || null,
          url: url || null,
          asked_to: asked,
          message_text: message || null,
        }),
      });
      const body = await r.json();
      if (r.status === 422) {
        const fields = (body.detail ?? []).map((d: { loc: string[]; msg: string }) => `${d.loc.at(-1)}: ${d.msg}`);
        setError(fields.join(" · ") || "invalid input");
      } else if (!r.ok) {
        setError(body.detail ?? `error ${r.status}`);
      } else {
        setRes(body);
      }
    } catch {
      setError("backend unreachable");
    } finally {
      setElapsed((performance.now() - t0) / 1000);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-5xl font-black">{t(T.title)}</h1>
          <p className="mt-2 text-2xl text-slate-300">{t(T.intro)}</p>
        </div>
        <div className="flex rounded-2xl bg-slate-800 p-1 text-2xl">
          {(["en", "hi"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-xl px-5 py-2 font-bold ${lang === l ? "bg-white text-slate-900" : "text-slate-300"}`}
            >
              {l === "en" ? "English" : "हिन्दी"}
            </button>
          ))}
        </div>
      </header>

      <section className="space-y-6 rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-700">
        <div>
          <div className="mb-3 text-2xl font-semibold">{t(T.who)}</div>
          <div className="flex flex-wrap gap-3">
            {TYPES.map(([v, label]) => (
              <button
                key={v}
                onClick={() => setType(v)}
                className={`rounded-2xl px-5 py-3 text-2xl ${type === v ? "bg-sky-600 font-bold" : "bg-slate-800 text-slate-300"}`}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <div className="mb-2 text-2xl font-semibold">{t(T.name)}</div>
          <input className={input} value={name} placeholder={t(T.namePh)} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <div className="mb-2 text-2xl font-semibold">{t(T.phone)}</div>
          <input className={input} inputMode="tel" value={phone} placeholder="98765 43210" onChange={(e) => setPhone(e.target.value)} />
        </label>
        <div className="grid gap-6 md:grid-cols-2">
          <label className="block">
            <div className="mb-2 text-xl">{t(T.upi)}</div>
            <input className={input} value={upi} placeholder="name@bank" onChange={(e) => setUpi(e.target.value)} />
          </label>
          <label className="block">
            <div className="mb-2 text-xl">{t(T.url)}</div>
            <input className={input} value={url} placeholder="example.com" onChange={(e) => setUrl(e.target.value)} />
          </label>
        </div>
        <div>
          <div className="mb-3 text-2xl font-semibold">{t(T.asked)}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {ASKS.map(([v, label]) => {
              const on = asked.includes(v);
              return (
                <button
                  key={v}
                  onClick={() => setAsked(on ? asked.filter((a) => a !== v) : [...asked, v])}
                  className={`flex items-center gap-4 rounded-2xl px-5 py-4 text-left text-2xl ${on ? "bg-red-700 font-bold" : "bg-slate-800 text-slate-300"}`}
                >
                  <span className="text-3xl">{on ? "☑" : "☐"}</span>
                  {t(label)}
                </button>
              );
            })}
          </div>
        </div>
        <label className="block">
          <div className="mb-2 text-xl">{t(T.message)}</div>
          <textarea className={`${input} h-28`} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <button
          disabled={busy}
          onClick={() => void submit()}
          className="w-full rounded-2xl bg-emerald-600 py-5 text-4xl font-black hover:bg-emerald-500 disabled:opacity-60"
        >
          {busy ? t(T.checking) : t(T.submit)}
        </button>
        {error && <div className="rounded-xl bg-red-900/60 p-4 text-2xl">⚠ {error}</div>}
      </section>

      {res && (
        <section className="space-y-6">
          <div className={`rounded-3xl p-8 ${LEVEL_BG[res.level]}`}>
            <div className="text-xl uppercase tracking-widest opacity-90">
              {t(T.risk)} · {res.level} · {res.score.toFixed(2)}
              {elapsed != null && ` · ${elapsed.toFixed(1)} s`}
            </div>
            <div className="mt-1 text-5xl font-black">{t(LEVEL_TEXT[res.level])}</div>
          </div>

          <div className="rounded-3xl bg-white p-8 text-slate-900">
            <div className="mb-4 text-3xl font-black">{t(T.steps)}</div>
            <ol className="list-decimal space-y-3 pl-8 text-2xl font-semibold">
              {res.next_steps.map((s, i) => (
                <li key={i}>{t(s)}</li>
              ))}
            </ol>
          </div>

          {res.verification_status !== "ok" && (
            <div className="rounded-2xl bg-amber-900/60 p-5 text-2xl">{t(T.unavailable)}</div>
          )}

          {res.top_reasons.length > 0 && (
            <div className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-700">
              <div className="mb-3 text-2xl text-slate-300">{t(T.why)}</div>
              <ul className="space-y-2 text-2xl">
                {res.top_reasons.map((r, i) => (
                  <li key={i}>• {t(r)}</li>
                ))}
              </ul>
            </div>
          )}

          {res.checks.map((c, i) => (
            <div key={i} className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-2xl font-bold">{t(CHECK_TITLE[c.check])}</div>
                <div className="flex items-center gap-3">
                  {c.confidence === "low" && <span className="text-lg text-amber-300">{t(T.lowConf)}</span>}
                  <span className={`rounded-full px-4 py-1 text-xl font-bold ${VERDICT_STYLE[c.verdict] ?? "bg-slate-600"}`}>
                    {VERDICT_LABEL[c.verdict] ? t(VERDICT_LABEL[c.verdict]) : c.verdict}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-2xl">{t(c.note)}</p>
              {c.official_contact && (
                <a
                  href={`tel:${c.official_contact.replace(/\s/g, "")}`}
                  className="mt-4 inline-block rounded-2xl bg-emerald-600 px-6 py-3 text-3xl font-black"
                >
                  📞 {t(T.official)}: {c.official_contact}
                </a>
              )}
              {c.sources.length > 0 && (
                <div className="mt-4">
                  <div className="text-lg text-slate-400">{t(T.sources)}</div>
                  <ul className="mt-1 space-y-3">
                    {c.sources.map((s, j) => (
                      <li key={j}>
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-xl text-sky-300 underline">
                          {s.title || s.url}
                        </a>
                        <div className="text-base text-slate-400">{new URL(s.url).hostname}</div>
                        {s.snippet && <div className="text-lg italic text-slate-300">“{s.snippet}”</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-3 text-base text-slate-500">
                {c.cached && c.fetched_at
                  ? `${t(T.cached)} ${new Date(c.fetched_at).toLocaleString()}`
                  : c.status === "ok" && `${(c.latency_ms / 1000).toFixed(1)} s`}
              </div>
            </div>
          ))}

          {res.text_analysis && (
            <div className="rounded-3xl bg-slate-900 p-6 ring-1 ring-amber-700">
              <div className="text-xl text-amber-300">{t(res.text_analysis.label)}</div>
              <div className="mt-2 text-2xl">
                {res.text_analysis.tactics.length ? res.text_analysis.tactics.join(" · ") : "—"}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
