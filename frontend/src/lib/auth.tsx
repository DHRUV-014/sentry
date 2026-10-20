import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db } from "./firebase";
import type { Profile } from "./profile";

// How long to wait for the profile before showing "couldn't load your account" with a retry.
const PROFILE_TIMEOUT_MS = 12000;

export type AuthState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "error"; message: string }
  | { status: "signedIn"; user: User; profile: Profile | null; displayName: string };

interface AuthContextValue {
  state: AuthState;
  retry: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function profileError(e: { code?: string }): string {
  if (e.code === "permission-denied")
    return "We couldn't open your account details (access was refused). Please try again in a moment.";
  if (e.code === "unavailable") return "We couldn't reach the server. Check your internet connection and try again.";
  return "We couldn't load your account. Please try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(auth ? { status: "loading" } : { status: "unconfigured" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!auth || !db) return;
    const firestore = db;
    let unsubProfile = () => {};
    let timer: number | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubProfile();
      window.clearTimeout(timer);
      if (!user) {
        setState({ status: "signedOut" });
        return;
      }
      setState({ status: "loading" });
      timer = window.setTimeout(
        () => setState({ status: "error", message: "We couldn't load your account. Check your internet connection and try again." }),
        PROFILE_TIMEOUT_MS,
      );
      unsubProfile = onSnapshot(
        doc(firestore, "users", user.uid),
        (snap) => {
          // An empty answer from the local cache isn't the server saying "no profile": wait for the server.
          if (!snap.exists() && snap.metadata.fromCache) return;
          window.clearTimeout(timer);
          setState((s) => ({
            status: "signedIn",
            user,
            profile: snap.exists() ? (snap.data() as Profile) : null,
            displayName: (s.status === "signedIn" && s.user.uid === user.uid && s.displayName) || user.displayName || "",
          }));
        },
        (e) => {
          window.clearTimeout(timer);
          setState({ status: "error", message: profileError(e) });
        },
      );
    });
    return () => {
      unsubAuth();
      unsubProfile();
      window.clearTimeout(timer);
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      retry,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth!, email, password);
      },
      signUp: async (name, email, password) => {
        const cred = await createUserWithEmailAndPassword(auth!, email, password);
        await updateProfile(cred.user, { displayName: name });
        // The auth listener has already fired without the name; pass it on for onboarding's pre-fill.
        setState((s) => (s.status === "signedIn" && s.user.uid === cred.user.uid ? { ...s, displayName: name } : s));
      },
      signInWithGoogle: async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithPopup(auth!, provider);
      },
      resetPassword: async (email) => {
        try {
          await sendPasswordResetEmail(auth!, email);
        } catch (e) {
          // Don't reveal whether an account exists for this email.
          if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
        }
      },
      signOutUser: async () => {
        await signOut(auth!);
      },
    }),
    [state, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The signed-in user; only for pages behind the route guard. */
export function useSignedIn() {
  const { state, ...rest } = useAuth();
  if (state.status !== "signedIn") throw new Error("useSignedIn used on a page that isn't behind the guard");
  return { ...state, ...rest };
}
