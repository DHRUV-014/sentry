import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

const focusRing = "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30";

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  loadingText?: string;
};

export function Button({ variant = "primary", loading, loadingText, disabled, className = "", children, ...rest }: ButtonProps) {
  const styles = {
    primary: "bg-accent text-accent-ink hover:bg-accent-hover shadow-sm",
    secondary: "bg-surface text-ink ring-1 ring-inset ring-line hover:bg-subtle",
    ghost: "text-accent hover:bg-accent/10",
  }[variant];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${styles} ${className}`}
    >
      {loading && <Spinner />}
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
      className={`rounded font-medium text-accent underline-offset-4 hover:underline disabled:opacity-60 ${focusRing} ${className}`}
    />
  );
}

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger">
      <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-.75-11.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4ZM10 14.75a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
      </svg>
      {children}
    </p>
  );
}

const inputBase =
  "block w-full rounded-lg bg-surface px-4 py-3 text-base text-ink ring-1 ring-inset placeholder:text-muted/70 transition-shadow focus:outline-none focus:ring-2";

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
        <label htmlFor={id} className="text-base font-medium text-ink">
          {label}
          {optional && <span className="ml-1.5 font-normal text-muted">(optional)</span>}
        </label>
        {labelAside}
      </div>
      <div className="relative flex">
        {prefix && (
          <span className="inline-flex select-none items-center rounded-l-lg bg-subtle px-4 text-base text-muted ring-1 ring-inset ring-line">
            {prefix}
          </span>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
          className={`${inputBase} ${prefix ? "rounded-l-none" : ""} ${trailing ? "pr-24" : ""} ${
            error ? "ring-danger focus:ring-danger" : "ring-line focus:ring-accent"
          }`}
        />
        {trailing && <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>}
      </div>
      {hint && (
        <div id={`${id}-hint`} className="mt-2 text-sm text-muted">
          {hint}
        </div>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

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
          className={`rounded-md px-3 py-1.5 text-sm font-semibold text-muted hover:bg-subtle hover:text-ink ${focusRing}`}
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
      <label htmlFor={id} className="mb-2 block text-base font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
        className={`${inputBase} appearance-none bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10 ${
          error ? "ring-danger focus:ring-danger" : "ring-line focus:ring-accent"
        }`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23778599'%3E%3Cpath d='M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z'/%3E%3C/svg%3E\")",
        }}
      >
        {children}
      </select>
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
      <legend className="mb-2 text-base font-medium text-ink">
        {legend}
        {optional && <span className="ml-1.5 font-normal text-muted">(optional)</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`relative flex min-h-12 cursor-pointer items-center rounded-lg px-4 text-base ring-1 ring-inset transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/30 ${
              value === o.value
                ? "bg-accent/10 font-semibold text-ink ring-2 ring-accent"
                : `bg-surface text-ink hover:bg-subtle ${error ? "ring-danger" : "ring-line"}`
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
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
          className={`mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded accent-[rgb(var(--accent))] ${focusRing}`}
        />
        <label htmlFor={id} className="cursor-pointer text-base leading-snug text-ink">
          {children}
        </label>
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

export function Banner({ kind, children }: { kind: "error" | "info" | "success"; children: ReactNode }) {
  const styles = {
    error: "bg-danger-soft text-ink ring-danger/40",
    info: "bg-info-soft text-ink ring-accent/30",
    success: "bg-ok-soft text-ink ring-ok/40",
  }[kind];
  const icon = {
    error: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-.75-11.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4ZM10 14.75a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
    info: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9.25 9.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4Z",
    success: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.86-9.7a.75.75 0 0 0-1.22-.87l-3.24 4.53-1.65-1.65a.75.75 0 0 0-1.06 1.06l2.27 2.27a.75.75 0 0 0 1.14-.09l3.76-5.25Z",
  }[kind];
  const iconColor = { error: "text-danger", info: "text-accent", success: "text-ok" }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex gap-3 rounded-lg p-4 text-base ring-1 ring-inset ${styles}`}>
      <svg viewBox="0 0 20 20" fill="currentColor" className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true">
        <path fillRule="evenodd" d={icon} clipRule="evenodd" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2.5 4.5 7v8.2c0 7.1 4.9 12.4 11.5 14.3 6.6-1.9 11.5-7.2 11.5-14.3V7L16 2.5Z" fill="rgb(var(--accent))" />
      <path d="m11 16.2 3.4 3.4 6.8-7.2" fill="none" stroke="rgb(var(--accent-ink))" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FullPageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas text-muted" role="status" aria-live="polite">
      <Logo className="h-12 w-12" />
      <div className="flex items-center gap-2 text-base">
        <Spinner />
        {label}…
      </div>
    </div>
  );
}
