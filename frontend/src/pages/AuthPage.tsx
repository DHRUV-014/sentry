import { useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import GoogleButton from "../components/GoogleButton";
import { Banner, Button, Checkbox, LinkButton, Logo, PasswordField, TextField } from "../components/ui";
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
  { title: "Your recordings are never stored", body: "Calls are analysed as they happen. Audio stays in memory and is never saved." },
  { title: "Family alerts only with consent", body: "We only alert the person you choose, and only if they've agreed." },
  { title: "Verified with official sources", body: "Numbers and claims are checked against official bank and government websites." },
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
  const color = ["bg-line", "bg-danger", "bg-accent", "bg-ok"][level];
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
      <main className="flex min-h-screen flex-col px-4 py-8 sm:px-8 lg:min-h-0 lg:justify-center lg:py-12">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile: the brand panel collapses into this header. */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo />
            <div>
              <div className="text-lg font-bold tracking-tight">Scam Shield</div>
              <div className="text-sm text-muted">AI that catches scam calls and tells you what's true</div>
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-base text-muted">
            {mode === "signin" ? "Sign in to keep your calls protected." : "It takes about two minutes."}
          </p>

          <div role="tablist" aria-label="Sign in or create an account" className="mt-8 grid grid-cols-2 rounded-lg bg-subtle p-1" onKeyDown={onTabKey}>
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
                className={`min-h-11 rounded-md text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                  mode === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
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

            <div className="flex items-center gap-4 text-sm text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            {mode === "signin" ? (
              <SignInForm busy={busy} setBusy={setBusy} setNotice={setNotice} disabled={unconfigured} />
            ) : (
              <SignUpForm busy={busy} setBusy={setBusy} setNotice={setNotice} disabled={unconfigured} />
            )}

            <p className="text-center text-base text-muted">
              {mode === "signin" ? "New to Scam Shield? " : "Already have an account? "}
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
    <aside className="relative hidden overflow-hidden bg-subtle px-12 py-12 lg:flex lg:flex-col lg:justify-between xl:px-16">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/10" aria-hidden="true" />
      <div className="relative flex items-center gap-3">
        <Logo className="h-10 w-10" />
        <span className="text-xl font-bold tracking-tight">Scam Shield</span>
      </div>
      <div className="relative max-w-lg">
        <p className="text-4xl font-bold leading-tight tracking-tight">AI that catches scam calls and tells you what's true</p>
        <ul className="mt-10 space-y-6">
          {TRUST_POINTS.map((p) => (
            <li key={p.title} className="flex gap-4">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                </svg>
              </span>
              <div>
                <div className="text-lg font-semibold">{p.title}</div>
                <div className="mt-1 text-base text-muted">{p.body}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-sm text-muted">English · हिन्दी · Hinglish</p>
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
        <a href="#terms" className="font-medium text-accent underline underline-offset-4">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#privacy" className="font-medium text-accent underline underline-offset-4">
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
