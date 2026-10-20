// Firebase error codes -> plain English. Anything unmapped gets a generic message (never the raw code).
const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match. Check them and try again, or reset your password.",
  "auth/wrong-password": "That email and password don't match. Check them and try again, or reset your password.",
  "auth/user-not-found": "That email and password don't match. Check them and try again, or reset your password.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead, or reset your password.",
  "auth/weak-password": "Choose a stronger password: at least 8 characters.",
  "auth/user-disabled": "This account has been turned off. Contact support for help.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "We couldn't reach the server. Check your internet connection and try again.",
  "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.",
  "auth/popup-closed-by-user": "The Google sign-in window was closed before you finished.",
  "auth/cancelled-popup-request": "The Google sign-in window was closed before you finished.",
  "auth/account-exists-with-different-credential":
    "This email is already registered with a password. Sign in with your email and password.",
  "auth/operation-not-allowed": "This sign-in method isn't turned on for this app yet.",
  "auth/unauthorized-domain": "Sign-in isn't allowed from this web address yet.",
  "auth/internal-error": "Something went wrong on our side. Please try again.",
  "permission-denied": "We couldn't save your details. Please check them and try again.",
  unavailable: "We couldn't reach the server. Check your internet connection and try again.",
};

export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  return MESSAGES[code] ?? "Something went wrong. Please try again.";
}

/** Closing the Google window on purpose isn't an error worth a red banner. */
export function isUserCancel(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
}
