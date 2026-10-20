import { FileAudio, Mic, Square } from "lucide-react";
import { useCallback, useReducer, useRef, useState } from "react";
import { AlertPanel, ClaimsPanel, HealthStrip, RiskChart, RiskMeter, TacticChain, Transcript, WhyPanel } from "../components/Panels";
import { Button, Toast } from "../components/ui";
import { startMic, streamFile, type Source } from "../lib/audio";
import { CallSession } from "../lib/session";
import { initialState, reduce } from "../lib/state";

type Phase = "idle" | "starting" | "live" | "ending";

/** Live protection: microphone or an uploaded recording, streamed through the same pipeline. */
export default function Live() {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [phase, setPhase] = useState<Phase>("idle");
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string>("");
  const session = useRef<CallSession | null>(null);
  const audio = useRef<Source | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const stop = useCallback(async () => {
    setPhase("ending");
    audio.current?.stop();
    audio.current = null;
    await session.current?.end(); // server transcribes what is still queued, then ends
    setPhase("idle");
  }, []);

  const start = useCallback(
    async (open: (onPcm: (b: ArrayBuffer) => void) => Promise<Source>) => {
      setError("");
      setPhase("starting");
      try {
        const s = await CallSession.create();
        session.current = s;
        dispatch({ type: "reset", sessionId: s.id });
        await s.subscribe(
          (event) => dispatch({ type: "event", event }),
          () => undefined,
        );
        await s.openAudio((code, reason) => {
          if (code !== 1000 && code !== 1005) setError(`Audio stream closed: ${reason || code}`);
        });
        const src = await open((chunk) => s.sendPcm(chunk));
        audio.current = src;
        setSource(src.label);
        setPhase("live");
        void src.done.then(() => {
          if (audio.current === src) void stop();
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        audio.current?.stop();
        await session.current?.end();
        setPhase("idle");
      }
    },
    [stop],
  );

  const onFile = (f: File | undefined) => {
    if (f) void start((onPcm) => streamFile(f, onPcm));
    if (fileInput.current) fileInput.current.value = "";
  };

  const busy = phase !== "idle";
  return (
    <main className="mx-auto max-w-content space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Live protection</h1>
          <p className="mt-1 text-base text-ink-2">Listens for scam patterns as the call happens · English · हिन्दी · Hinglish</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!busy && (
            <>
              <Button size="lg" onClick={() => void start(startMic)}>
                <Mic size={20} strokeWidth={1.5} aria-hidden="true" />
                Start listening
              </Button>
              <Button size="lg" variant="secondary" onClick={() => fileInput.current?.click()}>
                <FileAudio size={20} strokeWidth={1.5} aria-hidden="true" />
                Analyse a recording
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="audio/*,.wav"
                className="hidden"
                aria-label="Choose a call recording"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </>
          )}
          {busy && (
            <Button size="lg" variant="secondary" disabled={phase !== "live"} loading={phase !== "live"} onClick={() => void stop()}>
              {phase === "starting" ? (
                "Starting… (model warm-up)"
              ) : phase === "ending" ? (
                "Finishing…"
              ) : (
                <>
                  <Square size={16} strokeWidth={2} aria-hidden="true" />
                  Stop
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <HealthStrip />
        {phase === "live" && (
          <div className="flex items-center gap-2 text-sm font-medium text-ink" role="status">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            Listening: {source}
          </div>
        )}
      </div>

      {state.alert && <AlertPanel alert={state.alert} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <RiskMeter risk={state.risk} listening={phase === "live"} />
          <WhyPanel reasons={state.risk?.top_reasons ?? []} mode={state.mode} />
          <ClaimsPanel claims={state.claims} verify={state.risk?.signals?.verify ?? null} />
        </div>
        <div className="space-y-6 lg:col-span-7">
          <TacticChain stages={state.stages} chainTactics={state.chainTactics} />
          <RiskChart history={state.history} />
          <Transcript utterances={state.utterances} hits={state.hits} />
        </div>
      </div>

      {error && <Toast message={error} onClose={() => setError("")} />}
    </main>
  );
}
