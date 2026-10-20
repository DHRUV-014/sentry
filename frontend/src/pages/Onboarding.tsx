import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Banner, Button, Checkbox, LinkButton, Logo, RadioCards, SelectField, TextField } from "../components/ui";
import { useSignedIn } from "../lib/auth";
import { friendlyError } from "../lib/authErrors";
import {
  AGE_GROUPS,
  fromE164,
  isEmail,
  labelOf,
  LANGUAGES,
  parseMobile,
  RELATIONSHIPS,
  saveProfile,
  toE164,
  type AgeGroup,
  type Language,
  type Relationship,
} from "../lib/profile";
import { navigate, useLocation } from "../lib/router";

type Step = 1 | 2 | 3;
type Errors = Record<string, string>;
const STEPS: Record<Step, { title: string; intro: string }> = {
  1: { title: "Your details", intro: "So we can protect your calls in the language you're most comfortable with." },
  2: { title: "Trusted contact", intro: "Someone in your family, or a friend, who can check on you if a call looks like a scam." },
  3: { title: "Review & finish", intro: "Check everything is right. You can change any of it later." },
};
const AGE_OPTIONS: { value: AgeGroup | "none"; label: string }[] = [...AGE_GROUPS, { value: "none", label: "Prefer not to say" }];

interface Form {
  fullName: string;
  mobile: string;
  language: Language | null;
  ageGroup: AgeGroup | "none" | null;
  city: string;
  contactName: string;
  relationship: Relationship | "";
  contactMobile: string;
  contactEmail: string;
  consent: boolean;
}

function focusFirstError(errors: Errors) {
  const first = Object.keys(errors)[0];
  const el = document.getElementById(first) ?? document.querySelector<HTMLElement>(`[name="${first}"]`);
  el?.focus();
}

export default function Onboarding() {
  const { user, profile, displayName, signOutUser } = useSignedIn();
  const { search } = useLocation();
  // Fixed at mount: finishing setup flips onboardingComplete, which shouldn't relabel the buttons.
  const [editing] = useState(profile?.onboardingComplete === true);

  const [form, setForm] = useState<Form>(() => ({
    fullName: profile?.fullName ?? displayName ?? "",
    mobile: fromE164(profile?.mobile),
    language: profile?.language ?? null,
    ageGroup: profile ? (profile.ageGroup ?? (profile.mobile ? "none" : null)) : null,
    city: profile?.city ?? "",
    contactName: profile?.trustedContact?.name ?? "",
    relationship: profile?.trustedContact?.relationship ?? "",
    contactMobile: fromE164(profile?.trustedContact?.mobile),
    contactEmail: profile?.trustedContact?.email ?? "",
    consent: profile?.alertConsent === true,
  }));
  // A trusted contact was skipped if the person got past step 2 without one.
  const [skipped, setSkipped] = useState(() => !!profile && profile.onboardingStep >= 3 && !profile.trustedContact);
  const [step, setStep] = useState<Step>(() => {
    const asked = Number(search.get("step"));
    if (!profile) return 1; // nothing saved yet: always start at the beginning
    if (asked >= 1 && asked <= 3) return Math.min(asked, profile.onboardingStep) as Step;
    return (editing ? 3 : profile.onboardingStep) as Step;
  });
  // Opened from "Edit" on the review step (or from the dashboard): Next returns to the review.
  const [returnToReview, setReturnToReview] = useState(editing);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState<"next" | "skip" | null>(null);
  const [saveError, setSaveError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const nameTouched = useRef(false);

  // Leave only once the shared profile shows the finished setup, so the route guard agrees.
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (finished && profile?.onboardingComplete) navigate("/", { replace: true });
  }, [finished, profile?.onboardingComplete]);

  // Email sign-up sets the display name just after the account exists; pre-fill it when it arrives.
  useEffect(() => {
    if (!nameTouched.current && !form.fullName && displayName) setForm((f) => ({ ...f, fullName: displayName }));
  }, [displayName, form.fullName]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => rest);
  };

  const goTo = (s: Step) => {
    setErrors({});
    setSaveError("");
    setStep(s);
  };

  const validateStep1 = (): Errors => {
    const e: Errors = {};
    if (form.fullName.trim().length < 2) e.fullName = "Enter your full name.";
    if (!form.mobile.trim()) e.mobile = "Enter your mobile number.";
    else if (!parseMobile(form.mobile)) e.mobile = "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.";
    if (!form.language) e.language = "Choose the language you'd like us to use.";
    if (form.city.trim().length > 100) e.city = "Keep this under 100 characters.";
    return e;
  };

  const validateStep2 = (): Errors => {
    const e: Errors = {};
    if (form.contactName.trim().length < 2) e.contactName = "Enter their name.";
    if (!form.relationship) e.relationship = "Choose how you know them.";
    const theirs = parseMobile(form.contactMobile);
    if (!form.contactMobile.trim()) e.contactMobile = "Enter their mobile number.";
    else if (!theirs) e.contactMobile = "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.";
    else if (theirs === parseMobile(form.mobile)) e.contactMobile = "This is your own number. Enter your contact's number instead.";
    if (form.contactEmail.trim() && !isEmail(form.contactEmail.trim())) e.contactEmail = "Enter a valid email address, or leave it empty.";
    if (!form.consent) e.consent = "Please confirm they know about this and agree to receive alerts.";
    return e;
  };

  const save = async (kind: "next" | "skip", data: Parameters<typeof saveProfile>[1], next: () => void) => {
    setSaving(kind);
    setSaveError("");
    try {
      await saveProfile(user.uid, data, !profile);
      next();
    } catch (err) {
      setSaveError(friendlyError(err));
    } finally {
      setSaving(null);
    }
  };

  const savedStep = profile?.onboardingStep ?? 1;
  const after = (s: Step): Step => (returnToReview ? 3 : s);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (step === 1) {
      const errs = validateStep1();
      setErrors(errs);
      if (Object.keys(errs).length) return focusFirstError(errs);
      const next = after(2);
      await save(
        "next",
        {
          fullName: form.fullName.trim(),
          email: user.email ?? "",
          mobile: toE164(parseMobile(form.mobile)!),
          language: form.language!,
          ageGroup: form.ageGroup === "none" ? null : form.ageGroup,
          city: form.city.trim() || null,
          onboardingStep: Math.max(savedStep, next),
          onboardingComplete: editing,
        },
        () => goTo(next),
      );
    } else if (step === 2) {
      const errs = validateStep2();
      setErrors(errs);
      if (Object.keys(errs).length) return focusFirstError(errs);
      await save(
        "next",
        {
          trustedContact: {
            name: form.contactName.trim(),
            relationship: form.relationship as Relationship,
            mobile: toE164(parseMobile(form.contactMobile)!),
            email: form.contactEmail.trim() || null,
          },
          alertConsent: true,
          alertConsentAt: "now",
          onboardingStep: 3,
        },
        () => {
          setSkipped(false);
          goTo(3);
        },
      );
    } else {
      await save("next", { onboardingComplete: true, onboardingStep: 3 }, () => setFinished(true));
    }
  };

  const skip = () =>
    void save("skip", { trustedContact: null, alertConsent: false, alertConsentAt: null, onboardingStep: 3 }, () => {
      setSkipped(true);
      goTo(3);
    });

  const edit = (s: Step) => {
    setReturnToReview(true);
    goTo(s);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">Scam Shield</span>
          </div>
          {editing ? (
            <LinkButton onClick={() => navigate("/")}>Cancel</LinkButton>
          ) : (
            <LinkButton onClick={() => void signOutUser()}>Sign out</LinkButton>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <Progress step={step} />

        <div key={step} className="animate-step mt-8 rounded-xl bg-surface p-6 shadow-card ring-1 ring-line sm:p-8">
          <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold tracking-tight focus:outline-none sm:text-3xl">
            {STEPS[step].title}
          </h1>
          <p className="mt-2 text-base text-muted">{STEPS[step].intro}</p>

          <form noValidate onSubmit={(e) => void submit(e)} className="mt-8 space-y-6">
            {saveError && <Banner kind="error">{saveError}</Banner>}

            {step === 1 && (
              <>
                <TextField
                  id="fullName"
                  label="Full name"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(e) => {
                    nameTouched.current = true;
                    set("fullName", e.target.value);
                  }}
                  error={errors.fullName}
                />
                <TextField
                  id="mobile"
                  label="Mobile number"
                  prefix="+91"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  value={form.mobile}
                  onChange={(e) => set("mobile", e.target.value)}
                  error={errors.mobile}
                />
                <RadioCards
                  name="language"
                  legend="Preferred language"
                  options={LANGUAGES}
                  value={form.language}
                  onChange={(v) => set("language", v)}
                  error={errors.language}
                />
                <RadioCards name="ageGroup" legend="Age group" optional options={AGE_OPTIONS} value={form.ageGroup} onChange={(v) => set("ageGroup", v)} />
                <TextField
                  id="city"
                  label="City"
                  optional
                  autoComplete="address-level2"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  error={errors.city}
                />
              </>
            )}

            {step === 2 && (
              <>
                <div className="flex gap-3 rounded-lg bg-info-soft p-4 text-base ring-1 ring-inset ring-accent/20">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 1.9 3 4.7v4.6c0 4 2.8 7.4 7 8.8 4.2-1.4 7-4.8 7-8.8V4.7L10 1.9Z" clipRule="evenodd" />
                  </svg>
                  <p>
                    If we detect a likely scam during your call, we can send this person a short alert so they can check on you. They'll never hear
                    your calls or see recordings.
                  </p>
                </div>
                <TextField
                  id="contactName"
                  label="Their name"
                  autoComplete="off"
                  value={form.contactName}
                  onChange={(e) => set("contactName", e.target.value)}
                  error={errors.contactName}
                />
                <SelectField
                  id="relationship"
                  label="Relationship"
                  value={form.relationship}
                  onChange={(e) => set("relationship", e.target.value as Relationship)}
                  error={errors.relationship}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  id="contactMobile"
                  label="Their mobile number"
                  prefix="+91"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="98765 43210"
                  value={form.contactMobile}
                  onChange={(e) => set("contactMobile", e.target.value)}
                  error={errors.contactMobile}
                />
                <TextField
                  id="contactEmail"
                  label="Their email"
                  optional
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                  error={errors.contactEmail}
                />
                <Checkbox id="consent" checked={form.consent} onChange={(v) => set("consent", v)} error={errors.consent}>
                  I confirm this person knows about this and agrees to receive alerts.
                </Checkbox>
              </>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <ReviewSection title="Your details" onEdit={() => edit(1)}>
                  <Row label="Name" value={form.fullName.trim()} />
                  <Row label="Email" value={user.email ?? ""} />
                  <Row label="Mobile" value={`+91 ${parseMobile(form.mobile) ?? ""}`} />
                  <Row label="Language" value={labelOf(LANGUAGES, form.language)} />
                  <Row label="Age group" value={form.ageGroup && form.ageGroup !== "none" ? labelOf(AGE_GROUPS, form.ageGroup) : "Not given"} />
                  <Row label="City" value={form.city.trim() || "Not given"} />
                </ReviewSection>
                <ReviewSection title="Trusted contact" onEdit={() => edit(2)} editLabel={skipped ? "Add" : "Edit"}>
                  {skipped ? (
                    <p className="text-base text-muted">No trusted contact yet. You can add one now or later from your dashboard.</p>
                  ) : (
                    <>
                      <Row label="Name" value={form.contactName.trim()} />
                      <Row label="Relationship" value={labelOf(RELATIONSHIPS, form.relationship || null)} />
                      <Row label="Mobile" value={`+91 ${parseMobile(form.contactMobile) ?? ""}`} />
                      <Row label="Email" value={form.contactEmail.trim() || "Not given"} />
                      <Row label="Consent" value="They know and agree to receive alerts" />
                    </>
                  )}
                </ReviewSection>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center">
              {step > 1 && (
                <Button type="button" variant="secondary" onClick={() => goTo((step - 1) as Step)} disabled={saving !== null}>
                  Back
                </Button>
              )}
              <div className="flex flex-col-reverse gap-3 sm:ml-auto sm:flex-row">
                {step === 2 && (
                  <Button type="button" variant="ghost" onClick={skip} loading={saving === "skip"} loadingText="Saving…" disabled={saving === "next"}>
                    Skip for now
                  </Button>
                )}
                <Button type="submit" loading={saving === "next" || finished} loadingText="Saving…" disabled={saving === "skip"} className="sm:min-w-40">
                  {step === 3 ? (editing ? "Save changes" : "Finish setup") : returnToReview ? "Save & review" : "Next"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function Progress({ step }: { step: Step }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-base">
        <span className="font-semibold text-accent">Step {step} of 3</span>
        <span className="text-muted">{STEPS[step].title}</span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step}
        aria-valuetext={`Step ${step} of 3: ${STEPS[step].title}`}
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${(step / 3) * 100}%` }} />
      </div>
    </div>
  );
}

function ReviewSection({ title, onEdit, editLabel = "Edit", children }: { title: string; onEdit: () => void; editLabel?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <LinkButton onClick={onEdit} aria-label={`${editLabel} ${title.toLowerCase()}`}>
          {editLabel}
        </LinkButton>
      </div>
      <dl className="space-y-3 p-4">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[10rem_1fr]">
      <dt className="text-base text-muted">{label}</dt>
      <dd className="break-words text-base font-medium">{value}</dd>
    </div>
  );
}
