import {
  CircleAlert,
  CircleCheck,
  Info,
  Moon,
  OctagonAlert,
  ShieldCheck,
  Sun,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { useTheme } from "../lib/theme";
import type { Level } from "../lib/types";

// Trust Navy component kit. Colours come only from the tokens in index.css / tailwind.config.js.

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";
const ICON = { size: 18, strokeWidth: 1.5 } as const;

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- buttons

type Variant = "primary" | "secondary" | "ghost";
const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-pressed shadow-sm",
  secondary: "bg-surface text-ink ring-1 ring-inset ring-line hover:bg-subtle active:bg-line/60",
  ghost: "text-accent hover:bg-accent-tint active:bg-accent-tint/70",
};
const SIZE = { md: "min-h-11 px-4 text-base", lg: "min-h-12 px-6 text-base" };

/** Class string for links that look like buttons. */
export function buttonClass(variant: Variant = "primary", size: keyof typeof SIZE = "md") {
  return `inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${VARIANT[variant]} ${SIZE[size]}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: keyof typeof SIZE;
  loading?: boolean;
  loadingText?: string;
};

export function Button({ variant = "primary", size = "md", loading, loadingText, disabled, className = "", children, ...rest }: ButtonProps) {
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={`${buttonClass(variant, size)} ${className}`}>
      {loading && <Spinner className="h-4 w-4" />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

/** A text-style button (e.g. "Forgot password?"). */
export function LinkButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-sm font-medium text-accent underline-offset-4 hover:underline disabled:opacity-50 ${focusRing} ${className}`}
    />
  );
}

// ---------------------------------------------------------------- form fields

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger-text">
      <CircleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

export const inputClass =
  "block w-full rounded-control bg-surface px-4 py-3 text-base text-ink ring-1 ring-inset placeholder:text-muted transition-shadow duration-150 focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-subtle disabled:opacity-70";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  prefix?: string;
  trailing?: ReactNode;
  labelAside?: ReactNode;
};

export function TextField({ id, label, error, hint, optional, prefix, trailing, labelAside, className = "", ...rest }: TextFieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {optional && <span className="ml-1.5 font-normal text-ink-2">(optional)</span>}
        </label>
        {labelAside}
      </div>
      <div className="relative flex">
        {prefix && (
          <span className="inline-flex select-none items-center rounded-l-control bg-subtle px-4 text-base text-ink-2 ring-1 ring-inset ring-line">
            {prefix}
          </span>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
          className={`${inputClass} ${prefix ? "rounded-l-none" : ""} ${trailing ? "pr-24" : ""} ${
            error ? "ring-danger-text/70" : "ring-line"
          }`}
        />
        {trailing && <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>}
      </div>
      {hint && (
        <div id={`${id}-hint`} className="mt-2 text-sm text-ink-2">
          {hint}
        </div>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}
/** The spec's "Input": a labelled text field. */
export const Input = TextField;

export function PasswordField(props: Omit<TextFieldProps, "type" | "trailing">) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      {...props}
      type={shown ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-controls={props.id}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-subtle hover:text-ink ${focusRing}`}
        >
          {shown ? "Hide" : "Show"}
          <span className="sr-only"> password</span>
        </button>
      }
    />
  );
}

export function SelectField({
  id,
  label,
  error,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: string; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
          className={`${inputClass} appearance-none pr-10 ${error ? "ring-danger-text/70" : "ring-line"}`}
        >
          {children}
        </select>
        <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-2" fill="currentColor" aria-hidden="true">
          <path d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/** Native radio buttons styled as cards: arrow keys and screen readers work as usual. */
export function RadioCards<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  optional,
}: {
  name: string;
  legend: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string;
  optional?: boolean;
}) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-2 text-sm font-medium text-ink">
        {legend}
        {optional && <span className="ml-1.5 font-normal text-ink-2">(optional)</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`relative flex min-h-11 cursor-pointer items-center rounded-control px-4 text-base ring-inset transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
              value === o.value
                ? "bg-accent-tint font-semibold text-ink ring-2 ring-accent"
                : `bg-surface text-ink ring-1 hover:bg-subtle ${error ? "ring-danger-text/70" : "ring-line"}`
            }`}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </fieldset>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  children,
  error,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[rgb(var(--accent))] ${focusRing}`}
        />
        <label htmlFor={id} className="cursor-pointer text-base leading-snug text-ink">
          {children}
        </label>
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

// ---------------------------------------------------------------- surfaces

export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section {...rest} className={`rounded-card bg-surface shadow-card ring-1 ring-line/70 ${className}`}>
      {children}
    </section>
  );
}

export function Banner({ kind, children }: { kind: "error" | "info" | "success"; children: ReactNode }) {
  const style = {
    error: { box: "bg-risk-critical-tint", icon: CircleAlert, iconColor: "text-risk-critical" },
    info: { box: "bg-accent-tint", icon: Info, iconColor: "text-accent" },
    success: { box: "bg-accent-tint", icon: CircleCheck, iconColor: "text-accent" },
  }[kind];
  const Icon = style.icon;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex gap-3 rounded-control p-4 text-base text-ink ${style.box}`}>
      <Icon {...ICON} size={20} className={`mt-0.5 shrink-0 ${style.iconColor}`} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Badge({ children, className = "", icon: Icon }: { children: ReactNode; className?: string; icon?: LucideIcon }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${className || "bg-subtle text-ink-2"}`}>
      {Icon && <Icon size={14} strokeWidth={2} aria-hidden="true" />}
      {children}
    </span>
  );
}

export const RISK: Record<Level, { label: string; icon: LucideIcon; solid: string; tint: string; text: string; stroke: string }> = {
  LOW: { label: "Low risk", icon: ShieldCheck, solid: "bg-risk-low", tint: "bg-risk-low-tint", text: "text-risk-low", stroke: "rgb(var(--risk-low))" },
  MEDIUM: { label: "Medium risk", icon: CircleAlert, solid: "bg-risk-medium", tint: "bg-risk-medium-tint", text: "text-risk-medium", stroke: "rgb(var(--risk-medium))" },
  HIGH: { label: "High risk", icon: TriangleAlert, solid: "bg-risk-high", tint: "bg-risk-high-tint", text: "text-risk-high", stroke: "rgb(var(--risk-high))" },
  CRITICAL: { label: "Critical risk", icon: OctagonAlert, solid: "bg-risk-critical", tint: "bg-risk-critical-tint", text: "text-risk-critical", stroke: "rgb(var(--risk-critical))" },
};

/** Risk level: always icon + text, never colour alone. White on the solid risk colours is AA in both themes. */
export function RiskBadge({ level, size = "md", label }: { level: Level; size?: "md" | "lg"; label?: string }) {
  const r = RISK[level];
  const Icon = r.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold text-white ${r.solid} ${
        size === "lg" ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      <Icon size={size === "lg" ? 18 : 14} strokeWidth={2} aria-hidden="true" />
      {label ?? r.label}
    </span>
  );
}

// ---------------------------------------------------------------- navigation pieces

/** Segmented tabs with roving focus (arrow keys, Home, End). Panels are rendered by the caller. */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  idPrefix,
  className = "",
}: {
  label: string;
  tabs: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  idPrefix: string;
  className?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.value === value);
    const next =
      e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].value);
    refs.current[tabs[next].value]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className={`grid auto-cols-fr grid-flow-col rounded-control bg-subtle p-1 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.value}
          ref={(el) => (refs.current[t.value] = el)}
          id={`${idPrefix}-tab-${t.value}`}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          aria-controls={`${idPrefix}-panel`}
          tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
          className={`min-h-10 rounded-[8px] px-3 text-sm font-semibold transition-colors duration-150 ${focusRing} ${
            value === t.value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Slim "Step n of N" progress. */
export function Stepper({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-accent tabular-nums">
          Step {step} of {total}
        </span>
        <span className="text-ink-2">{label}</span>
      </div>
      <div
        className="mt-3 flex gap-1.5"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-valuetext={`Step ${step} of ${total}: ${label}`}
      >
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="relative h-1 flex-1 overflow-hidden rounded-full bg-line">
            <span
              className="absolute inset-0 origin-left rounded-full bg-accent transition-transform duration-300 ease-out"
              style={{ transform: `scaleX(${i < step ? 1 : 0})` }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- feedback

/** A dismissible message pinned to the bottom of the screen; errors are announced immediately. */
export function Toast({ message, onClose, kind = "error" }: { message: ReactNode; onClose: () => void; kind?: "error" | "info" }) {
  const Icon = kind === "error" ? CircleAlert : Info;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role={kind === "error" ? "alert" : "status"}
        className="pointer-events-auto flex w-full max-w-md animate-step items-start gap-3 rounded-card bg-surface p-4 text-base text-ink shadow-lift ring-1 ring-line"
      >
        <Icon {...ICON} size={20} className={`mt-0.5 shrink-0 ${kind === "error" ? "text-risk-critical" : "text-accent"}`} aria-hidden="true" />
        <div className="flex-1">{message}</div>
        <button type="button" onClick={onClose} className={`-m-1 rounded-md p-1 text-ink-2 hover:bg-subtle hover:text-ink ${focusRing}`} aria-label="Dismiss">
          <X {...ICON} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-tint text-accent">
        <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="mt-4 text-base font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-control bg-subtle motion-reduce:animate-none ${className}`} />;
}

// ---------------------------------------------------------------- brand + theme

/** Shield with a short waveform inside: "listening, protectively". */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2.5 4.5 7v8.2c0 7.1 4.9 12.4 11.5 14.3 6.6-1.9 11.5-7.2 11.5-14.3V7L16 2.5Z" fill="rgb(var(--accent))" />
      <g stroke="rgb(var(--accent-ink))" strokeWidth="2.2" strokeLinecap="round">
        <path d="M11 14.5v3" />
        <path d="M14.3 11.5v9" />
        <path d="M17.7 13v6" />
        <path d="M21 15v2" />
      </g>
    </svg>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-control text-ink-2 transition-colors hover:bg-subtle hover:text-ink ${focusRing} ${className}`}
    >
      {dark ? <Sun {...ICON} size={20} aria-hidden="true" /> : <Moon {...ICON} size={20} aria-hidden="true" />}
    </button>
  );
}

export function FullPageLoader({ label = "Loading" }: { label?: string }) {
  // Content-shaped placeholder rather than a spinner; announced once for screen readers.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-4" role="status" aria-live="polite">
      <Logo className="h-10 w-10" />
      <div className="w-full max-w-xs space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="mx-auto h-3 w-2/3" />
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** Calls fn after `ms`, re-armed whenever deps change; cleaned up on unmount. */
export function useTimeout(fn: () => void, ms: number | null, deps: unknown[] = []) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (ms == null) return;
    const id = window.setTimeout(() => saved.current(), ms);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}
