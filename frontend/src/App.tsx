import { MotionConfig, motion } from "motion/react";
import { lazy, Suspense, useLayoutEffect, type ReactNode } from "react";
import AppShell from "./components/AppShell";
import { Banner, Button, FullPageLoader, Logo } from "./components/ui";
import { AuthProvider, useAuth, type AuthState } from "./lib/auth";
import { EASE } from "./lib/brand";
import { navigate, safeNext, useLocation } from "./lib/router";
import Landing from "./pages/landing/Landing";

// The landing page ships in the main bundle (it's the first paint); everything else loads on demand.
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Live = lazy(() => import("./pages/Live"));
const Check = lazy(() => import("./Check"));

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </MotionConfig>
  );
}

const APP_PAGES = ["/dashboard", "/demo", "/check"];

/** Where the current visitor belongs. "/" (landing) is public. Signed out: app pages -> /auth.
 *  Signed in without finished onboarding: /auth and app pages -> /onboarding. Signed in: /auth ->
 *  `next` or /dashboard. Unknown paths -> landing. */
function target(path: string, search: URLSearchParams, state: AuthState): string {
  if (path === "/") return path;
  if (state.status === "signedOut" || state.status === "unconfigured") {
    if (path === "/auth") return path;
    return APP_PAGES.includes(path) ? `/auth?next=${encodeURIComponent(path)}` : "/";
  }
  if (state.status !== "signedIn") return path;
  if (!state.profile?.onboardingComplete) return path === "/onboarding" || path === "/auth" || APP_PAGES.includes(path) ? "/onboarding" : "/";
  if (path === "/auth") return safeNext(search.get("next")) ?? "/dashboard";
  return path === "/onboarding" || APP_PAGES.includes(path) ? path : "/";
}

function Routes() {
  const { state, retry } = useAuth();
  const { path, search } = useLocation();
  const to = target(path, search, state);
  const here = to === path || (to.startsWith("/auth") && path === "/auth");

  useLayoutEffect(() => {
    if (!here) navigate(to, { replace: true });
  }, [here, to]);

  // The landing page never waits for auth: its navbar fills in once the state is known.
  if (path === "/") return <Page id="/"><Landing /></Page>;
  if (state.status === "loading") return <FullPageLoader />;
  if (state.status === "error") return <LoadError message={state.message} retry={retry} />;
  if (!here) return <FullPageLoader />;

  let page: ReactNode;
  if (path === "/auth") page = <AuthPage />;
  else if (path === "/onboarding") page = <Onboarding key={search.get("step") ?? ""} />;
  else if (path === "/demo") page = <AppShell><Live /></AppShell>;
  else if (path === "/check") page = <AppShell><Check /></AppShell>;
  else page = <AppShell><Dashboard /></AppShell>;
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Page id={path}>{page}</Page>
    </Suspense>
  );
}

/** Soft fade between pages (landing -> auth -> onboarding -> dashboard). */
function Page({ id, children }: { id: string; children: ReactNode }) {
  return (
    <motion.div key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, ease: EASE }}>
      {children}
    </motion.div>
  );
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <Logo className="mx-auto h-10 w-10" />
        <Banner kind="error">{message}</Banner>
        <Button onClick={retry}>Try again</Button>
      </div>
    </main>
  );
}
