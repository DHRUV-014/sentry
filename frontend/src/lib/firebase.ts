import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from "firebase/firestore";
import firebaseJson from "../../firebase.json";

// Web app config comes only from the environment (frontend/.env); see .env.example.
const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const ENV_NAMES: Record<keyof typeof config, string> = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  appId: "VITE_FIREBASE_APP_ID",
};

/** Names of required variables that are missing; empty when Firebase is configured. */
export const missingConfig = (Object.keys(config) as (keyof typeof config)[])
  .filter((k) => !config[k])
  .map((k) => ENV_NAMES[k]);

export const usingEmulators = env.VITE_FIREBASE_EMULATORS === "true";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (missingConfig.length === 0) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  if (usingEmulators) {
    const { auth: a, firestore: f } = firebaseJson.emulators;
    connectAuthEmulator(auth, `http://${a.host}:${a.port}`, { disableWarnings: true });
    connectFirestoreEmulator(db, f.host, f.port);
  }
}

export { auth, db };
