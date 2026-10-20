import type { ReactNode } from "react";
import { Link } from "../components/AppShell";
import { useSignedIn } from "../lib/auth";
import { formatMobile, labelOf, LANGUAGES, RELATIONSHIPS } from "../lib/profile";

const card = "rounded-xl bg-surface p-6 shadow-card ring-1 ring-line";
const linkBtn =
  "inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-base font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30";

export default function Home() {
  const { profile } = useSignedIn();
  const contact = profile?.trustedContact;
  const firstName = profile?.fullName.split(/\s+/)[0] ?? "";

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hello{firstName && `, ${firstName}`}</h1>
        <p className="mt-2 text-lg text-muted">What would you like to do?</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Action
          to="/demo"
          title="Protect a call"
          body="Listen to a call as it happens and get a warning if the caller uses scam tactics."
          cta="Start live protection"
        />
        <Action
          to="/check"
          title="Check a caller"
          body="Someone claimed to be from your bank, the police or a courier? Check their number against official sources."
          cta="Check a caller"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className={card} aria-labelledby="contact-h">
          <h2 id="contact-h" className="text-xl font-semibold">
            Trusted contact
          </h2>
          {contact ? (
            <>
              <p className="mt-3 text-lg font-medium">
                {contact.name} <span className="font-normal text-muted">· {labelOf(RELATIONSHIPS, contact.relationship)}</span>
              </p>
              <p className="text-base text-muted">{formatMobile(contact.mobile)}</p>
              <p className="mt-4 text-base text-muted">
                Text and WhatsApp alerts to your trusted contact aren't switched on yet. Today, warnings appear on screen during the call.
              </p>
              <Link to="/onboarding?step=2" className={`${linkBtn} mt-4 text-accent ring-1 ring-inset ring-line hover:bg-subtle`}>
                Change contact
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-base text-muted">
                No trusted contact yet. Add a family member or friend who can check on you if a call looks like a scam.
              </p>
              <Link to="/onboarding?step=2" className={`${linkBtn} mt-4 bg-accent text-accent-ink hover:bg-accent-hover`}>
                Add trusted contact
              </Link>
            </>
          )}
        </section>

        <section className={card} aria-labelledby="details-h">
          <h2 id="details-h" className="text-xl font-semibold">
            Your details
          </h2>
          <dl className="mt-3 space-y-2 text-base">
            <Detail label="Name">{profile?.fullName}</Detail>
            <Detail label="Mobile">{formatMobile(profile?.mobile)}</Detail>
            <Detail label="Language">{labelOf(LANGUAGES, profile?.language)}</Detail>
          </dl>
          <Link to="/onboarding?step=1" className={`${linkBtn} mt-4 text-accent ring-1 ring-inset ring-line hover:bg-subtle`}>
            Edit details
          </Link>
        </section>
      </div>
    </main>
  );
}

function Action({ to, title, body, cta }: { to: string; title: string; body: string; cta: string }) {
  return (
    <section className={`${card} flex flex-col`}>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 flex-1 text-base text-muted">{body}</p>
      <Link to={to} className={`${linkBtn} mt-6 self-start bg-accent text-accent-ink hover:bg-accent-hover`}>
        {cta}
      </Link>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
