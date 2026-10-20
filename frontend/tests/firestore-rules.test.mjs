// Firestore security rules, tested against the local emulator: `npm run test:rules`.
// Each case signs in as a real (emulated) user and checks the write/read is allowed or refused.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, deleteDoc, doc, getDoc, initializeFirestore, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";

const { emulators } = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url)));
const projectId = process.env.GCLOUD_PROJECT ?? "demo-scamshield";
let n = 0;

async function client(email) {
  const app = initializeApp({ apiKey: "emulator", projectId, authDomain: "localhost", appId: "emulator" }, `app${n++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${emulators.auth.host}:${emulators.auth.port}`, { disableWarnings: true });
  const db = initializeFirestore(app, {});
  connectFirestoreEmulator(db, emulators.firestore.host, emulators.firestore.port);
  const user = email ? (await createUserWithEmailAndPassword(auth, email, "password123")).user : null;
  return { db, uid: user?.uid, email };
}

const base = (email) => ({
  fullName: "Asha Verma",
  email,
  mobile: "+919876543210",
  language: "hi",
  ageGroup: "60plus",
  city: null,
  onboardingStep: 2,
  onboardingComplete: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
const contact = { name: "Ravi Verma", relationship: "son", mobile: "+919812345678", email: null };

let failures = 0;
async function expect(name, allowed, op) {
  try {
    await op();
    if (!allowed) throw new Error("was allowed");
    console.log(`  ok   ${name}`);
  } catch (e) {
    const denied = e.code === "permission-denied";
    if (!allowed && denied) return console.log(`  ok   ${name} (denied)`);
    failures++;
    console.log(`  FAIL ${name}: ${e.message}`);
  }
}

const stamp = Date.now();
const a = await client(`a${stamp}@example.com`);
const b = await client(`b${stamp}@example.com`);
const anon = await client(null);
const refA = (c) => doc(c.db, "users", a.uid);

console.log("firestore.rules");
await expect("signed-out visitor can't read a profile", false, () => getDoc(refA(anon)));
await expect("email must be the signed-in account's", false, () => setDoc(refA(a), base("someone@else.com")));
await expect("unknown fields (e.g. aadhaar) are refused", false, () => setDoc(refA(a), { ...base(a.email), aadhaar: "1234 5678 9012" }));
await expect("invalid mobile is refused", false, () => setDoc(refA(a), { ...base(a.email), mobile: "+915555555555" }));
await expect("createdAt must be the server time", false, () => setDoc(refA(a), { ...base(a.email), createdAt: Timestamp.fromDate(new Date(2020, 0, 1)) }));
await expect("user creates own profile", true, () => setDoc(refA(a), base(a.email)));
await expect("user reads own profile", true, async () => assert.equal((await getDoc(refA(a))).data().fullName, "Asha Verma"));
await expect("another user can't read it", false, () => getDoc(refA(b)));
await expect("another user can't write it", false, () => setDoc(refA(b), base(b.email)));
await expect("trusted contact without consent is refused", false, () =>
  updateDoc(refA(a), { trustedContact: contact, updatedAt: serverTimestamp() }));
await expect("trusted contact with own number is refused", false, () =>
  updateDoc(refA(a), { trustedContact: { ...contact, mobile: "+919876543210" }, alertConsent: true, alertConsentAt: serverTimestamp(), updatedAt: serverTimestamp() }));
await expect("trusted contact with consent is saved", true, () =>
  updateDoc(refA(a), { trustedContact: contact, alertConsent: true, alertConsentAt: serverTimestamp(), onboardingStep: 3, updatedAt: serverTimestamp() }));
await expect("withdrawing consent while keeping the contact is refused", false, () =>
  updateDoc(refA(a), { alertConsent: false, updatedAt: serverTimestamp() }));
await expect("createdAt can't be changed later", false, () =>
  updateDoc(refA(a), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
await expect("updatedAt must be the server time", false, () =>
  updateDoc(refA(a), { city: "Pune", updatedAt: Timestamp.fromDate(new Date(2020, 0, 1)) }));
await expect("onboarding can be completed", true, () => updateDoc(refA(a), { onboardingComplete: true, updatedAt: serverTimestamp() }));
await expect("contact can be removed (skip)", true, () =>
  updateDoc(refA(a), { trustedContact: null, alertConsent: false, alertConsentAt: null, updatedAt: serverTimestamp() }));
await expect("finishing without a mobile number is refused", false, () => {
  const { mobile: _omit, ...noMobile } = base(b.email);
  return setDoc(doc(b.db, "users", b.uid), { ...noMobile, onboardingComplete: true });
});
await expect("user deletes own profile", true, () => deleteDoc(refA(a)));

console.log(failures ? `\n${failures} rule test(s) failed` : "\nall rule tests passed");
process.exit(failures ? 1 : 0);
