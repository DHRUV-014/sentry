import { useCallback, useReducer, useRef, useState } from "react";
import { AlertPanel, HealthStrip, RiskChart, RiskMeter, TacticChain, Transcript, WhyPanel } from "./components/Panels";
import { startMic, streamFile, type Source } from "./lib/audio";
import { CallSession } from "./lib/session";
import { initialState, reduce } from "./lib/state";

type Phase = "idle" | "starting" | "live" | "ending";

export default function App() {
  if (location.pathname !== "/demo") {
    return (
      <main className="p-10 text-3xl">
        <a className="underline" href="/demo">Open the Scam Shield demo →</a>
      </main>
    );
  }
  return <Demo />;
}

function Demo() {
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
    <main className="mx-auto max-w-[1800px] space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-5xl font-black tracking-tight">Scam Shield</h1>
          <p className="text-xl text-slate-400">Live scam-call warning for older adults · English · हिन्दी · Hinglish</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {!busy && (
            <>
              <button
                className="rounded-2xl bg-emerald-600 px-8 py-4 text-3xl font-bold hover:bg-emerald-500"
                onClick={() => void start(startMic)}
              >
                🎙 Start listening
              </button>
              <button
                className="rounded-2xl bg-slate-700 px-6 py-4 text-2xl font-semibold hover:bg-slate-600"
                onClick={() => fileInput.current?.click()}
              >
                Upload WAV
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="audio/*,.wav"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </>
          )}
          {busy && (
            <button
              className="rounded-2xl bg-red-600 px-8 py-4 text-3xl font-bold hover:bg-red-500 disabled:opacity-50"
              disabled={phase !== "live"}
              onClick={() => void stop()}
            >
              {phase === "starting" ? "Starting… (model warm-up)" : phase === "ending" ? "Finishing…" : "■ Stop"}
            </button>
          )}
        </div>
      </header>

      <HealthStrip />
      {phase === "live" && <div className="text-xl text-emerald-300">● Listening: {source}</div>}
      {error && <div className="rounded-xl bg-red-900/60 p-4 text-2xl text-red-100">⚠ {error}</div>}

      {state.alert && <AlertPanel alert={state.alert} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-2">
          <RiskMeter risk={state.risk} />
          <RiskChart history={state.history} />
          <WhyPanel reasons={state.risk?.top_reasons ?? []} mode={state.mode} />
        </div>
        <div className="space-y-6 xl:col-span-3">
          <TacticChain stages={state.stages} chainTactics={state.chainTactics} />
          <Transcript utterances={state.utterances} hits={state.hits} />
        </div>
      </div>
    </main>
  );
}
