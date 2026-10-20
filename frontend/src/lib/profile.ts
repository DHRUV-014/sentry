import { doc, serverTimestamp, setDoc, type Timestamp } from "firebase/firestore";
import { db } from "./firebase";

// users/{uid}. These are the only fields we collect; firestore.rules rejects anything else.
export type Language = "en" | "hi" | "hinglish";
export type AgeGroup = "under30" | "30to59" | "60plus";
export type Relationship = "son" | "daughter" | "spouse" | "parent" | "sibling" | "friend" | "other";

export interface TrustedContact {
  name: string;
  relationship: Relationship;
  mobile: string; // +91XXXXXXXXXX
  email: string | null;
}

export interface Profile {
  fullName: string;
  email: string;
  mobile?: string;
  language?: Language;
  ageGroup?: AgeGroup | null;
  city?: string | null;
  trustedContact?: TrustedContact | null;
  alertConsent?: boolean;
  alertConsentAt?: Timestamp | null;
  onboardingStep: number;
  onboardingComplete: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "hinglish", label: "Hinglish" },
];

export const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: "under30", label: "Under 30" },
  { value: "30to59", label: "30–59" },
  { value: "60plus", label: "60+" },
];

export const RELATIONSHIPS: { value: Relationship; label: string }[] = [
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "spouse", label: "Spouse" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "friend", label: "Friend" },
  { value: "other", label: "Other" },
];

export const labelOf = <T extends string>(list: { value: T; label: string }[], v: T | null | undefined) =>
  list.find((o) => o.value === v)?.label ?? "";

/** Indian mobile as typed ("+91 98765-43210", "098765 43210") -> 10 digits, or null if invalid. */
export function parseMobile(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export const toE164 = (tenDigits: string) => `+91${tenDigits}`;
export const fromE164 = (v: string | undefined | null) => (v?.startsWith("+91") ? v.slice(3) : "");
export const formatMobile = (v: string | undefined | null) => {
  const d = fromE164(v);
  return d ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : "";
};

export const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

/** Merge-write the user's document. createdAt is set once, on the first write. */
export async function saveProfile(
  uid: string,
  data: Partial<Omit<Profile, "createdAt" | "updatedAt" | "alertConsentAt">> & { alertConsentAt?: "now" | null },
  isNew: boolean,
) {
  if (!db) throw new Error("Firestore is not configured");
  const { alertConsentAt, ...rest } = data;
  await setDoc(
    doc(db, "users", uid),
    {
      ...rest,
      ...(alertConsentAt !== undefined && { alertConsentAt: alertConsentAt === "now" ? serverTimestamp() : null }),
      ...(isNew && { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
