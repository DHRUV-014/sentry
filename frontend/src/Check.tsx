import { ArrowRight, BadgeCheck, CircleCheck, CircleHelp, CircleMinus, ExternalLink, Info, OctagonAlert, Phone, Square, SquareCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import InstitutionPicker, { type Institution } from "./components/InstitutionPicker";
import { Banner, Button, Card, RISK, RiskBadge, Skeleton, Toast, buttonClass, focusRing, inputClass } from "./components/ui";
import { addRecentCheck, timeAgo } from "./lib/recentChecks";
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
  text_analysis: { label: Bi; mode: string; tactics: string[]; protective: string[] } | null;
  contributions: { signal: string; value: number; weight: number }[];
  coercion_score: number;
  protective_strength: number;
  caps_applied: string[];
  next_steps: Bi[];
  institution_match: {
    status: "resolved" | "ambiguous" | "suggest" | "unknown" | "other" | "none";
    institution: Institution | null;
    candidates: Institution[];
  };
  institution_note: Bi | null;
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
const LEVEL_TEXT: Record<Level, Bi> = {
  LOW: { en: "Low risk", hi: "कम खतरा" },
  MEDIUM: { en: "Be careful", hi: "सावधान रहें" },
  HIGH: { en: "Likely a scam", hi: "शायद धोखाधड़ी" },
  CRITICAL: { en: "Scam: stop now", hi: "धोखाधड़ी: अभी रुकें" },
};

const TACTIC_LABEL: Record<string, Bi> = {
  AUTHORITY: { en: "Claimed authority", hi: "अधिकारी होने का दावा" },
  THREAT: { en: "Threats", hi: "धमकी" },
  URGENCY: { en: "Rushing you", hi: "जल्दबाज़ी का दबाव" },
  SECRECY: { en: "Secrecy", hi: "बात छिपाने को कहना" },
  ISOLATION: { en: "Keeping you alone", hi: "अकेला रखना" },
  PAYMENT: { en: "Money demand", hi: "पैसे की माँग" },
  CREDENTIAL: { en: "OTP / PIN demand", hi: "ओटीपी / पिन की माँग" },
};
const SOURCE_LABEL: Record<string, Bi> = {
  form: { en: "you reported it", hi: "आपने बताया" },
  model: { en: "found in the message", hi: "संदेश में मिला" },
  lexicon: { en: "found in the message", hi: "संदेश में मिला" },
};
const CAP_LABEL: Record<string, Bi> = {
  identity_only: {
    en: "Capped at LOW: a claimed identity alone is not a warning sign",
    hi: "LOW तक सीमित: सिर्फ़ पहचान का दावा खतरे का संकेत नहीं है",
  },
  verification_alone: {
    en: "Capped below HIGH: online checks alone can't make it HIGH",
    hi: "HIGH से नीचे सीमित: सिर्फ़ ऑनलाइन जाँच से HIGH नहीं होता",
  },
  single_tactic_or_utterance: {
    en: "Capped below HIGH: only one warning sign so far",
    hi: "HIGH से नीचे सीमित: अभी तक सिर्फ़ एक खतरे का संकेत",
  },
  critical_gate: {
    en: "Capped below CRITICAL: no money/OTP demand together with threats or secrecy",
    hi: "CRITICAL से नीचे सीमित: धमकी या गोपनीयता के साथ पैसे/ओटीपी की माँग नहीं",
  },
};
const VERIFY_LABEL: Record<string, Bi> = {
  MISMATCH: { en: "Number not on the official website", hi: "नंबर आधिकारिक वेबसाइट पर नहीं" },
  REPORTS_FOUND: { en: "Fraud reports found online", hi: "इंटरनेट पर धोखाधड़ी की शिकायतें मिलीं" },
};

// Each verdict: icon + label (never colour alone). Red/green only where it is a risk signal.
const VERDICT: Record<string, { label: Bi; icon: LucideIcon; cls: string }> = {
  MATCH: { label: { en: "Verified", hi: "नंबर सही" }, icon: BadgeCheck, cls: "bg-risk-low text-white" },
  MISMATCH: { label: { en: "Mismatch", hi: "नंबर मेल नहीं खाता" }, icon: OctagonAlert, cls: "bg-risk-critical text-white" },
  UNKNOWN: { label: { en: "Not verified", hi: "पता नहीं" }, icon: CircleHelp, cls: "bg-subtle text-ink ring-1 ring-inset ring-line" },
  ADVISORY_FOUND: { label: { en: "Warning found", hi: "चेतावनी मिली" }, icon: Info, cls: "bg-accent text-accent-ink" },
  REPORTS_FOUND: { label: { en: "Reports found", hi: "शिकायतें मिलीं" }, icon: TriangleAlert, cls: "bg-risk-high text-white" },
  NO_REPORTS_FOUND: { label: { en: "No reports found", hi: "कोई शिकायत नहीं मिली" }, icon: CircleCheck, cls: "bg-subtle text-ink ring-1 ring-inset ring-line" },
  UNAVAILABLE: { label: { en: "Unavailable", hi: "उपलब्ध नहीं" }, icon: CircleMinus, cls: "bg-subtle text-ink ring-1 ring-inset ring-line" },
};

function VerdictBadge({ verdict, t }: { verdict: string; t: (b: Bi) => string }) {
  const v = VERDICT[verdict] ?? { label: { en: verdict, hi: verdict }, icon: CircleHelp, cls: "bg-subtle text-ink" };
  const Icon = v.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${v.cls}`}>
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
      {t(v.label)}
    </span>
  );
}

function Breakdown({ res, t }: { res: Response; t: (b: Bi) => string }) {
  const rows: { label: string; effect: string }[] = [];
  for (const c of res.contributions) {
    const parts = c.signal.split(".");
    if (parts[0] === "coercion" && parts.length === 3 && TACTIC_LABEL[parts[1]]) {
      const src = SOURCE_LABEL[parts[2]] ? ` (${t(SOURCE_LABEL[parts[2]])})` : "";
      rows.push({ label: `${t(TACTIC_LABEL[parts[1]])}${src}`, effect: `+${(c.value * c.weight).toFixed(2)}` });
    } else if (c.signal === "coercion.chain_factor") {
      rows.push({
        label: t({ en: "Scam-pattern stages reached (multiplier)", hi: "धोखाधड़ी के तरीके के चरण (गुणक)" }),
        effect: `× ${c.value.toFixed(2)}`,
      });
    } else if (c.signal === "coercion.protective") {
      rows.push({
        label: t({ en: "Genuine advice heard (lowers risk)", hi: "असली सलाह सुनी गई (खतरा कम)" }),
        effect: `−${(c.value * 100).toFixed(0)}%`,
      });
    } else if (parts[0] === "verify") {
      rows.push({ label: t(VERIFY_LABEL[parts[1]] ?? { en: parts[1], hi: parts[1] }), effect: `+${c.weight.toFixed(2)}` });
    }
  }
  return (
    <Card className="p-6" aria-labelledby="breakdown-h">
      <h2 id="breakdown-h" className="mb-3 text-sm font-semibold">
        {t({ en: "Why this level", hi: "यह स्तर क्यों" })}
      </h2>
      <table className="w-full text-base">
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="py-1 text-ink-2">{t({ en: "No warning signs reported", hi: "कोई खतरे का संकेत नहीं बताया गया" })}</td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line">
              <td className="py-2.5 pr-4">{r.label}</td>
              <td className="py-2.5 text-right font-medium tabular-nums">{r.effect}</td>
            </tr>
          ))}
          <tr>
            <td className="pt-3 text-ink-2">{t({ en: "Warning-sign score", hi: "खतरे के संकेतों का स्कोर" })}</td>
            <td className="pt-3 text-right tabular-nums">{res.coercion_score.toFixed(2)}</td>
          </tr>
          <tr>
            <td className="pt-1 font-medium">{t({ en: "Final score (with online checks)", hi: "अंतिम स्कोर (ऑनलाइन जाँच सहित)" })}</td>
            <td className="pt-1 text-right font-semibold tabular-nums">
              {res.score.toFixed(2)} → {res.level}
            </td>
          </tr>
        </tbody>
      </table>
      {res.caps_applied.map((c) => (
        <p key={c} className="mt-3 flex gap-2 text-sm text-ink-2">
          <Info size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          {t(CAP_LABEL[c] ?? { en: c, hi: c })}
        </p>
      ))}
      <p className="mt-3 text-xs tabular-nums text-ink-2">LOW &lt; 0.30 ≤ MEDIUM &lt; 0.55 ≤ HIGH &lt; 0.80 ≤ CRITICAL</p>
    </Card>
  );
}

/** One "Is this true?" result: what the caller said, what the official source says, and where from. */
function CheckCard({ c, t, now }: { c: CheckResult; t: (b: Bi) => string; now: number }) {
  const said = c.check === "institution_contact" ? [c.input.institution, c.input.phone].filter(Boolean).join(" · ") : null;
  const when = c.fetched_at ?? c.sources[0]?.fetched_at ?? null;
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-lg font-semibold">{t(CHECK_TITLE[c.check])}</h3>
        <div className="flex items-center gap-2">
          {c.confidence === "low" && <span className="text-xs font-medium text-ink-2">{t(T.lowConf)}</span>}
          <VerdictBadge verdict={c.verdict} t={t} />
        </div>
      </div>

      {said && (
        <div className="mt-4 grid items-center gap-2 rounded-control bg-subtle p-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
          <div>
            <div className="text-xs font-medium text-ink-2">{t({ en: "Caller said", hi: "कॉल करने वाले ने कहा" })}</div>
            <div className="mt-0.5 font-medium tabular-nums">{said}</div>
          </div>
          <ArrowRight size={18} strokeWidth={1.5} className="hidden text-ink-2 sm:block" aria-hidden="true" />
          <div>
            <div className="text-xs font-medium text-ink-2">{t({ en: "Truth", hi: "सच" })}</div>
            <div className="mt-0.5 font-medium tabular-nums">
              {c.official_contact ? `${t(T.official)}: ${c.official_contact}` : t(VERDICT[c.verdict]?.label ?? { en: c.verdict, hi: c.verdict })}
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 text-base">{t(c.note)}</p>

      {c.official_contact && (
        <a href={`tel:${c.official_contact.replace(/\s/g, "")}`} className={`${buttonClass("primary", "lg")} mt-4`}>
          <Phone size={18} strokeWidth={1.5} aria-hidden="true" />
          {t({ en: "Call the official number", hi: "आधिकारिक नंबर पर कॉल करें" })}: <span className="tabular-nums">{c.official_contact}</span>
        </a>
      )}

      {c.sources.length > 0 && (
        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-2">{t(T.sources)}</div>
          <ul className="mt-2 space-y-3">
            {c.sources.map((s, j) => (
              <li key={j}>
                <a href={s.url} target="_blank" rel="noreferrer" className={`inline-flex items-start gap-1.5 rounded-sm font-medium text-accent underline-offset-4 hover:underline ${focusRing}`}>
                  {s.title || s.url}
                  <ExternalLink size={14} strokeWidth={1.5} className="mt-1 shrink-0" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
                <div className="text-xs text-ink-2">{new URL(s.url).hostname}</div>
                {s.snippet && <div className="mt-0.5 text-sm italic text-ink-2">“{s.snippet}”</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 text-xs tabular-nums text-ink-2">
        {c.cached && c.fetched_at
          ? `${t(T.cached)} ${new Date(c.fetched_at).toLocaleString()}`
          : c.status === "ok" && when
            ? `${t({ en: "Checked", hi: "जाँचा गया" })} ${timeAgo(when, now)} · ${(c.latency_ms / 1000).toFixed(1)} s`
            : c.status === "ok" && `${(c.latency_ms / 1000).toFixed(1)} s`}
      </div>
    </Card>
  );
}

const label = "mb-2 block text-base font-semibold";
const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center gap-2 rounded-control px-4 text-base transition-colors duration-150 ${focusRing} ${
    on ? "bg-accent-tint font-semibold text-ink ring-2 ring-inset ring-accent" : "bg-surface text-ink ring-1 ring-inset ring-line hover:bg-subtle"
  }`;

export default function Check() {
  const [lang, setLang] = useState<Lang>("en");
  const [type, setType] = useState("bank");
  const [name, setName] = useState("");
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [directory, setDirectory] = useState<Institution[]>([]);
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
  const searchable = !["relative", "other"].includes(type);

  useEffect(() => {
    fetch("/verify/institutions")
      .then((r) => r.json())
      .then(setDirectory)
      .catch(() => setDirectory([]));
  }, []);

  const submit = async (pickedId: string | null = institutionId) => {
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
          claimed_identity_name: searchable && !pickedId ? name : "",
          institution_id: searchable ? pickedId : null,
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
        // Dashboard "Recent checks" (this browser only): who they claimed to be, never the number.
        const resolved = (body as Response).institution_match?.institution;
        addRecentCheck({
          at: new Date().toISOString(),
          level: body.level,
          claimed: resolved?.name ?? TYPES.find(([v]) => v === type)?.[1].en ?? type,
          verdict: (body as Response).checks.find((c) => c.check === "institution_contact")?.verdict ?? null,
        });
      }
    } catch {
      setError("backend unreachable");
    } finally {
      setElapsed((performance.now() - t0) / 1000);
      setBusy(false);
    }
  };

  const now = Date.now();
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold sm:text-3xl">{t(T.title)}</h1>
          <p className="mt-2 text-base text-ink-2">{t(T.intro)}</p>
        </div>
        <div className="flex rounded-control bg-subtle p-1" role="group" aria-label="Language">
          {(["en", "hi"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={`min-h-10 rounded-[8px] px-4 text-sm font-semibold transition-colors ${focusRing} ${lang === l ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}
            >
              {l === "en" ? "English" : "हिन्दी"}
            </button>
          ))}
        </div>
      </header>

      <Card className="space-y-8 p-6 sm:p-8">
        <fieldset>
          <legend className={label}>{t(T.who)}</legend>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={type === v}
                onClick={() => {
                  setType(v);
                  setInstitutionId(null);
                }}
                className={chip(type === v)}
              >
                {t(l)}
              </button>
            ))}
          </div>
        </fieldset>
        {searchable ? (
          <div>
            <div className={label} id="inst-label">
              {t(T.name)}
            </div>
            <InstitutionPicker items={directory} type={type} value={institutionId} text={name} onPick={setInstitutionId} onText={setName} t={t} />
          </div>
        ) : (
          <Banner kind="info">
            {t({
              en: "We never search people's names online. We'll check the number and what they asked you to do.",
              hi: "हम लोगों के नाम कभी ऑनलाइन नहीं खोजते। हम नंबर और उनकी माँगों की जाँच करेंगे।",
            })}
          </Banner>
        )}
        <label className="block">
          <span className={label}>{t(T.phone)}</span>
          <input className={`${inputClass} ring-line tabular-nums`} inputMode="tel" value={phone} placeholder="98765 43210" onChange={(e) => setPhone(e.target.value)} />
        </label>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">{t(T.upi)}</span>
            <input className={`${inputClass} ring-line`} value={upi} placeholder="name@bank" onChange={(e) => setUpi(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">{t(T.url)}</span>
            <input className={`${inputClass} ring-line`} value={url} placeholder="example.com" onChange={(e) => setUrl(e.target.value)} />
          </label>
        </div>
        <fieldset>
          <legend className={label}>{t(T.asked)}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ASKS.map(([v, l]) => {
              const on = asked.includes(v);
              const Icon = on ? SquareCheck : Square;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAsked(on ? asked.filter((a) => a !== v) : [...asked, v])}
                  className={`${chip(on)} justify-start text-left`}
                >
                  <Icon size={20} strokeWidth={1.5} className={on ? "text-accent" : "text-ink-2"} aria-hidden="true" />
                  {t(l)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">{t(T.message)}</span>
          <textarea className={`${inputClass} ring-line h-28`} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <Button size="lg" className="w-full" loading={busy} loadingText={t(T.checking)} onClick={() => void submit()}>
          {t(T.submit)}
        </Button>
      </Card>

      {busy && (
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-36 w-full rounded-card" />
          <Skeleton className="h-48 w-full rounded-card" />
        </div>
      )}

      {res && (
        <section className="animate-step space-y-6" aria-label={t({ en: "Result", hi: "नतीजा" })}>
          <div className={`rounded-card p-6 ring-1 ring-inset ring-line sm:p-8 ${RISK[res.level].tint}`}>
            <div className="flex flex-wrap items-center gap-3">
              <RiskBadge level={res.level} size="lg" />
              <span className="text-sm tabular-nums text-ink-2">
                {t(T.risk)} {res.score.toFixed(2)}
                {elapsed != null && ` · ${elapsed.toFixed(1)} s`}
              </span>
            </div>
            <p className="mt-4 font-display text-4xl leading-none text-ink">{t(LEVEL_TEXT[res.level])}</p>
            {res.top_reasons[0] && <p className="mt-3 text-lg text-ink">{t(res.top_reasons[0])}</p>}
          </div>

          <Card className="p-6 sm:p-8" aria-labelledby="steps-h">
            <h2 id="steps-h" className="text-xl font-semibold">
              {t(T.steps)}
            </h2>
            <ol className="mt-4 space-y-3">
              {res.next_steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-lg">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-tint text-sm font-semibold tabular-nums text-accent">
                    {i + 1}
                  </span>
                  {t(s)}
                </li>
              ))}
            </ol>
          </Card>

          {res.verification_status !== "ok" && <Banner kind="info">{t(T.unavailable)}</Banner>}

          {res.institution_note && (
            <Card className="p-6">
              <p className="text-base">{t(res.institution_note)}</p>
              {["ambiguous", "suggest"].includes(res.institution_match.status) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {res.institution_match.candidates.map((c) => (
                    <Button
                      key={c.id}
                      variant="secondary"
                      onClick={() => {
                        setInstitutionId(c.id);
                        void submit(c.id);
                      }}
                    >
                      {t({ en: "Did you mean", hi: "क्या आपका मतलब" })} {lang === "en" ? c.name : c.name_hi}?
                    </Button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {res.checks.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{t({ en: "Is this true?", hi: "क्या यह सच है?" })}</h2>
              {res.checks.map((c, i) => (
                <CheckCard key={i} c={c} t={t} now={now} />
              ))}
            </div>
          )}

          {res.top_reasons.length > 1 && (
            <Card className="p-6" aria-labelledby="why-h">
              <h2 id="why-h" className="mb-3 text-sm font-semibold">
                {t(T.why)}
              </h2>
              <ul className="space-y-2 text-base">
                {res.top_reasons.map((r, i) => (
                  <li key={i} className="border-l-2 border-risk-high/50 pl-3">
                    {t(r)}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Breakdown res={res} t={t} />

          {res.text_analysis && (
            <Card className="p-6">
              <div className="text-sm font-semibold">{t(res.text_analysis.label)}</div>
              <div className="mt-2 text-base">{res.text_analysis.tactics.length ? res.text_analysis.tactics.join(" · ") : "—"}</div>
              {res.text_analysis.protective.length > 0 && (
                <div className="mt-2 text-base text-ink-2">
                  {t({ en: "Genuine advice found:", hi: "असली सलाह मिली:" })} “{res.text_analysis.protective.join("”, “")}”
                </div>
              )}
            </Card>
          )}
        </section>
      )}

      {error && <Toast message={error} onClose={() => setError("")} />}
    </main>
  );
}
