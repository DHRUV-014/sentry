import { BadgeCheck, EyeOff, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import BrandMotion from "../components/BrandMotion";
import GoogleButton from "../components/GoogleButton";
import Link from "../components/Link";
import { Banner, Button, Checkbox, LinkButton, Logo, PasswordField, TextField, ThemeToggle, focusRing } from "../components/ui";
import { BRAND, EASE, TAGLINE } from "../lib/brand";
import { useAuth } from "../lib/auth";
import { friendlyError, isUserCancel } from "../lib/authErrors";
import { missingConfig } from "../lib/firebase";
import { isEmail } from "../lib/profile";
import { navigate, useLocation } from "../lib/router";

type Mode = "signin" | "signup";
type Notice = { kind: "error" | "info" | "success"; text: ReactNode } | null;
type Errors = Record<string, string>;

const MIN_PASSWORD = 8;
const TRUST_POINTS = [
  { icon: EyeOff, title: "Your recordings are never stored", body: "Calls are analysed as they happen. Audio stays in memory and is never saved." },
  { icon: Users, title: "Family alerts only with consent", body: "We only alert the person you choose, and only if they've agreed." },
  { icon: BadgeCheck, title: "Verified with official sources", body: "Numbers and claims are checked against official bank and government websites." },
];

function focusFirstError(errors: Errors, ids: string[]) {
  const first = ids.find((id) => errors[id]);
  if (first) document.getElementById(first)?.focus();
}

export function passwordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (pw.length < MIN_PASSWORD) return { level: 0, label: `Use at least ${MIN_PASSWORD} characters` };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const score = variety + (pw.length >= 12 ? 1 : 0);
  if (score <= 2) return { level: 1, label: "Weak: add numbers, symbols or more words" };
  if (score === 3) return { level: 2, label: "Good" };
  return { level: 3, label: "Strong" };
}

function StrengthMeter({ password }: { password: string }) {
  const { level, label } = passwordStrength(password);
  const color = ["bg-line", "bg-ink-2", "bg-accent/60", "bg-accent"][level];
  return (
    <div aria-live="polite">
      <div className="mb-1.5 flex gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${password && level >= i ? color : "bg-line"}`} />
        ))}
      </div>
      {password ? label : `At least ${MIN_PASSWORD} characters`}
    </div>
  );
}

export default function AuthPage() {
  const { search } = useLocation();
  const [mode, setModeState] = useState<Mode>(search.get("mode") === "signup" ? "signup" : "signin");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<"form" | "google" | "reset" | null>(null);
  const { signInWithGoogle } = useAuth();
  const tabs = useRef<Record<Mode, HTMLButtonElement | null>>({ signin: null, signup: null });
  const unconfigured = missingConfig.length > 0;

  const setMode = (m: Mode) => {
    setModeState(m);
    setNotice(null);
    const params = new URLSearchParams(location.search);
    if (m === "signup") params.set("mode", "signup");
    else params.delete("mode");
    const qs = params.toString();
    navigate(`/auth${qs ? `?${qs}` : ""}`, { replace: true });
  };

  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next: Mode = e.key === "Home" ? "signin" : e.key === "End" ? "signup" : mode === "signin" ? "signup" : "signin";
    setMode(next);
    tabs.current[next]?.focus();
  };

  const google = async () => {
    setNotice(null);
    setBusy("google");
    try {
      await signInWithGoogle(); // the route guard takes over once signed in
    } catch (e) {
      if (!isUserCancel(e)) setNotice({ kind: "error", text: friendlyError(e) });
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <BrandPanel />
      <main className="relative flex min-h-screen flex-col px-4 py-6 sm:px-8 lg:min-h-0 lg:justify-center lg:py-12">
        <ThemeToggle className="absolute right-4 top-4 sm:right-6" />
        <div className="mx-auto w-full max-w-md lg:rounded-card lg:bg-surface lg:p-10 lg:shadow-card lg:ring-1 lg:ring-line/70">
          {/* Mobile: the brand panel collapses into this header. */}
          <Link to="/" className={`mb-10 inline-flex items-center gap-2.5 rounded-md lg:hidden ${focusRing}`}>
            <Logo />
            <span className="text-lg font-semibold tracking-tight">{BRAND}</span>
          </Link>

          <h1 className="text-2xl font-semibold sm:text-3xl">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-base text-ink-2">
            {mode === "signin" ? "Sign in to keep your calls protected." : "It takes about two minutes."}
          </p>

          <div role="tablist" aria-label="Sign in or create an account" className="mt-8 grid grid-cols-2 rounded-control bg-subtle p-1" onKeyDown={onTabKey}>
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                ref={(el) => (tabs.current[m] = el)}
                id={`tab-${m}`}
                role="tab"
                type="button"
                aria-selected={mode === m}
                aria-controls={`panel-${m}`}
                tabIndex={mode === m ? 0 : -1}
                onClick={() => setMode(m)}
                className={`relative min-h-10 rounded-[8px] text-sm font-semibold transition-colors duration-150 ${focusRing} ${
                  mode === m ? "text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                {mode === m && (
                  <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-[8px] bg-surface shadow-sm" transition={{ duration: 0.3, ease: EASE }} />
                )}
                <span className="relative">{m === "signin" ? "Sign in" : "Create account"}</span>
              </button>
            ))}
          </div>

          <div id={`panel-${mode}`} role="tabpanel" aria-labelledby={`tab-${mode}`} className="mt-6 space-y-6">
            {unconfigured && (
              <Banner kind="error">
                <strong>Sign-in isn't set up yet.</strong> Add {missingConfig.join(", ")} to <code>frontend/.env</code> (see{" "}
                <code>.env.example</code>) and restart the app.
              </Banner>
            )}
            {notice && <Banner kind={notice.kind}>{notice.text}</Banner>}

            <GoogleButton onClick={() => void google()} loading={busy === "google"} disabled={unconfigured || (busy !== null && busy !== "google")} />

            <div className="flex items-center gap-4 text-sm text-ink-2" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === "signup" ? 16 : -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "signup" ? -16 : 16 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                {mode === "signin" ? (
                  <SignInForm busy={busy} setBusy={setBusy} setNotice={setNotice} disabled={unconfigured} />
                ) : (
                  <SignUpForm busy={busy} setBusy={setBusy} setNotice={setNotice} disabled={unconfigured} />
                )}
              </motion.div>
            </AnimatePresence>

            <p className="text-center text-base text-ink-2">
              {mode === "signin" ? `New to ${BRAND}? ` : "Already have an account? "}
              <LinkButton onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Create an account" : "Sign in"}
              </LinkButton>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="paper-grain relative hidden overflow-hidden bg-subtle px-12 py-12 lg:flex lg:flex-col lg:justify-between xl:px-16">
      <BrandMotion className="pointer-events-none absolute -right-28 -top-16 h-[440px] w-[440px]" />
      <Link to="/" className={`relative flex w-fit items-center gap-3 rounded-md ${focusRing}`}>
        <Logo className="h-9 w-9" />
        <span className="text-xl font-semibold tracking-tight">{BRAND}</span>
      </Link>
      <div className="relative max-w-md">
        <p className="font-display text-4xl leading-[1.05] text-ink">{TAGLINE}</p>
        <ul className="mt-10 space-y-6">
          {TRUST_POINTS.map((p) => (
            <li key={p.title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-card">
                <p.icon size={18} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <div>
                <div className="text-base font-semibold">{p.title}</div>
                <div className="mt-0.5 text-sm text-ink-2">{p.body}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-sm text-ink-2">English · हिन्दी · Hinglish</p>
    </aside>
  );
}

interface FormProps {
  busy: "form" | "google" | "reset" | null;
  setBusy: (b: "form" | "google" | "reset" | null) => void;
  setNotice: (n: Notice) => void;
  disabled: boolean;
}

function SignInForm({ busy, setBusy, setNotice, disabled }: FormProps) {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errs: Errors = {};
    if (!email.trim()) errs["signin-email"] = "Enter your email address.";
    else if (!isEmail(email.trim())) errs["signin-email"] = "Enter a valid email address, like name@example.com.";
    if (!password) errs["signin-password"] = "Enter your password.";
    setErrors(errs);
    setNotice(null);
    if (Object.keys(errs).length) return focusFirstError(errs, ["signin-email", "signin-password"]);
    setBusy("form");
    try {
      await signIn(email.trim(), password); // the route guard takes over once signed in
    } catch (err) {
      setNotice({ kind: "error", text: friendlyError(err) });
      setBusy(null);
    }
  };

  const forgot = async () => {
    setNotice(null);
    const value = email.trim();
    if (!value || !isEmail(value)) {
      setErrors({ "signin-email": "Enter your email address above, then choose “Forgot password?” again." });
      document.getElementById("signin-email")?.focus();
      return;
    }
    setErrors({});
    setBusy("reset");
    try {
      await resetPassword(value);
      setNotice({
        kind: "success",
        text: (
          <>
            If an account exists for <strong>{value}</strong>, we've sent a link to reset your password. Check your inbox and spam folder.
          </>
        ),
      });
    } catch (err) {
      setNotice({ kind: "error", text: friendlyError(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="space-y-5">
      <TextField
        id="signin-email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors["signin-email"]}
        disabled={disabled}
      />
      <PasswordField
        id="signin-password"
        label="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors["signin-password"]}
        disabled={disabled}
        labelAside={
          <LinkButton onClick={() => void forgot()} disabled={disabled || busy !== null} className="text-sm">
            {busy === "reset" ? "Sending…" : "Forgot password?"}
          </LinkButton>
        }
      />
      <Button type="submit" className="w-full" loading={busy === "form"} loadingText="Signing in…" disabled={disabled || (busy !== null && busy !== "form")}>
        Sign in
      </Button>
    </form>
  );
}

function SignUpForm({ busy, setBusy, setNotice, disabled }: FormProps) {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errs: Errors = {};
    if (name.trim().length < 2) errs["signup-name"] = "Enter your full name.";
    if (!email.trim()) errs["signup-email"] = "Enter your email address.";
    else if (!isEmail(email.trim())) errs["signup-email"] = "Enter a valid email address, like name@example.com.";
    if (password.length < MIN_PASSWORD) errs["signup-password"] = `Your password needs at least ${MIN_PASSWORD} characters.`;
    if (!confirm) errs["signup-confirm"] = "Type your password again.";
    else if (confirm !== password) errs["signup-confirm"] = "The passwords don't match.";
    if (!terms) errs["signup-terms"] = "Please accept the Terms and Privacy Policy to continue.";
    setErrors(errs);
    setNotice(null);
    if (Object.keys(errs).length)
      return focusFirstError(errs, ["signup-name", "signup-email", "signup-password", "signup-confirm", "signup-terms"]);
    setBusy("form");
    try {
      await signUp(name.trim(), email.trim(), password); // the route guard moves on to onboarding
    } catch (err) {
      setNotice({ kind: "error", text: friendlyError(err) });
      setBusy(null);
    }
  };

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="space-y-5">
      <TextField
        id="signup-name"
        label="Full name"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors["signup-name"]}
        disabled={disabled}
      />
      <TextField
        id="signup-email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors["signup-email"]}
        disabled={disabled}
      />
      <PasswordField
        id="signup-password"
        label="Password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors["signup-password"]}
        hint={<StrengthMeter password={password} />}
        disabled={disabled}
      />
      <PasswordField
        id="signup-confirm"
        label="Confirm password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={errors["signup-confirm"]}
        disabled={disabled}
      />
      <Checkbox id="signup-terms" checked={terms} onChange={setTerms} error={errors["signup-terms"]}>
        I agree to the{" "}
        <a href="#terms" className={`rounded-sm font-medium text-accent underline underline-offset-4 ${focusRing}`}>
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#privacy" className={`rounded-sm font-medium text-accent underline underline-offset-4 ${focusRing}`}>
          Privacy Policy
        </a>
        .
      </Checkbox>
      <Button type="submit" className="w-full" loading={busy === "form"} loadingText="Creating account…" disabled={disabled || (busy !== null && busy !== "form")}>
        Create account
      </Button>
    </form>
  );
}
