# Scam Shield

A real-time safety layer for VoIP calls that protects older adults from digital-arrest,
impersonation (fake police or bank) and voice-clone "relative in trouble" scams.
**Detect the manipulation. Alert the family. Stop the transfer before it happens.**

The MVP is a browser-to-browser WebRTC call (`/caller` ↔ `/elder`). The backend analyzes the
caller's audio live. Streaming a WAV through the same WebSocket is the fallback and the test path.
Apps can't tap ordinary cellular calls; never claim otherwise in UI or docs.

## Non-negotiable principles

1. **Nothing hardcoded.** No canned transcripts, no per-scenario if/else, no fixture fallbacks in
   the app, no seeded demo data, no default or fake scores. Every number shown comes from the
   pipeline running on real audio input.
   - Domain knowledge (lexicon patterns, institution lists, weights, reason templates) lives in YAML
     and describes tactics, never specific calls.
2. **Every risk change carries evidence:**
   `contributions: [{signal, value, weight, evidence_utterance_id}]` plus `top_reasons` in English
   and Hindi.
3. **Risk rules** (configured in `app/risk/weights.yaml`):
   - Levels: LOW < 0.3 ≤ MEDIUM < 0.55 ≤ HIGH < 0.8 ≤ CRITICAL.
   - Time decay (half-life about 90 s) and hysteresis.
   - A single keyword can never reach HIGH.
   - Voice evidence alone is capped at HIGH.
   - CRITICAL needs PAYMENT or CREDENTIAL, plus THREAT, SECRECY, or a verification mismatch.
4. **Data minimisation.**
   - TinyFish receives only extracted entities (kind + value), never audio or transcripts.
   - Audio is never written to disk. It lives in an in-memory ring buffer only.
   - With `STORE_TRANSCRIPTS=false`, transcript text is redacted before it's persisted.
5. **Graceful degradation.** Every external dependency has a timeout from `.env` and reports its
   status as `ok | loading | degraded | unavailable | disabled | unconfigured`, both on `/health` and
   as `status` events. When a signal is missing, the UI shows "signal unavailable", never a guess.
6. **No secrets in code.** All config comes from `backend/.env` via pydantic-settings. Keep
   `.env.example` current. Never commit `.env`.
7. **Don't invent APIs.** For TinyFish, Twilio and any other vendor, use only what the official docs
   say. TinyFish docs will be pasted by the team at B6.
8. **Never block the event loop.** Model inference runs in dedicated worker threads with timeouts.
9. **Synthetic audio is for pipeline tests only.** Files named `synthetic_*` are macOS TTS. Never
   use them to train, calibrate or evaluate the voice anti-spoof model.

## Build order (stop, show the acceptance result and commit after each)

| # | Milestone | Status |
|---|---|---|
| B1 | Skeleton: config, events, bus, sessions, `/health`, Makefile | ✅ done |
| B2 | Audio ingest + VAD + STT, `tools/stream_wav.py`, STT benchmark | ✅ done |
| B3 | Coercion engine (lexicon + sequence) + entity extraction | next |
| B3.5 | Train our coercion classifier | |
| B4 | Risk fusion + alert dispatcher with the **dashboard** alert channel | |
| F1 | WebRTC call `/caller` ↔ `/elder` streaming to the backend | |
| F2 | `/elder` live risk banner + full-screen warning (English + Hindi) | |
| F3 | `/family` dashboard: risk gauge, timeline, tactic chain, live alerts | |
| F4 | `/ops` judge view: transcript highlights, signal contributions, latency, health, signal toggles | |
| B5 | Voice anti-spoof model + calibration | |
| B6 | TinyFish verification (from the pasted official docs) | |
| B7 | Eval harness, ablation, learned fusion weights | |
| B8 | Stage hardening: `make demo`, model warm-up, offline degradation | |
| B9 | SMS + WhatsApp alert channels via Twilio | last |

### Alerts (B4 design, final)

- `AlertChannel` interface. The first channel is **dashboard**: it emits an `alert` event on
  `/ws/events/{id}`, which `/family` shows instantly.
- The alert contains:
  - the level
  - `top_reasons`
  - the caller's claims (institution, numbers, UPI IDs, case numbers)
  - the verified official number when verification provides one
  - a "Call <name> now" action
- The dispatcher fires on the **first transition to HIGH or CRITICAL**, sends **one alert per
  contact per call**, builds the content from fusion output, and logs latency.
- A `contacts` table (name, E.164 phone, opt-in flag, revocable) exists from B4, so SMS and
  WhatsApp (B9) plug in as additional channels without changing the dispatcher.

## Stack

- **Backend:**
  - Python 3.11, FastAPI, uvicorn, asyncio, websockets
  - pydantic v2 + pydantic-settings, aiosqlite, PyYAML, numpy, httpx
  - pytest + pytest-asyncio, ruff
- **Audio:**
  - webrtcvad (`webrtcvad-wheels`)
  - faster-whisper on CPU, int8: `small` for transcription, `tiny` for Hindi/English language ID
- **Text:** rapidfuzz for fuzzy lexicon matching.
- **Frontend (F1–F4):** React + Vite + TypeScript + Tailwind, WebRTC, and an AudioWorklet that
  downsamples to 16 kHz mono int16.

## Layout

```
backend/
  app/main.py            FastAPI app, routes, startup model warm-up
  app/config.py          Settings from backend/.env
  app/events.py          Event envelope, payload base types, per-session bus
  app/components.py      Component status registry (/health + status events)
  app/session.py         Per-call sessions, idle cleanup, drains the pipeline on end
  app/pipeline.py        Per-call: frames -> ring buffer -> VAD -> STT worker -> utterance events
  app/storage.py         SQLite: sessions, events, alerts (no audio)
  app/audio/             buffer.py (ring buffer), vad.py (segmenter), stt.py (providers)
  app/coercion/          lexicon.yaml, lexicon.py, sequence.py, engine.py         (B3)
  app/entities/          extract.py                                              (B3)
  app/risk/              weights.yaml, fusion.py                                 (B4)
  app/alerts/            dispatcher.py, channels (dashboard; sms/whatsapp in B9) (B4)
  app/voice/             antispoof.py (interface; model in B5)
  app/verify/            verifier.py  (interface; TinyFish in B6)
  tools/                 stream_wav, make_test_audio, bench_stt, stt_report, wer
  tests/                 unit + pipeline tests; tests/audio_scripts/ = synthetic call scripts
samples/                 local audio (gitignored); samples/synthetic_tts/ = rendered TTS calls
```

## API

- `POST /sessions` → `{session_id}`
- `WS /ws/audio/{id}`: binary 20 ms frames, 16 kHz mono int16 (exactly 640 bytes, or whole multiples)
- `WS /ws/events/{id}`: JSON events. Late subscribers first receive recent events again.
- `POST /sessions/{id}/end`: drains in-flight transcriptions, then emits `status session ended`
- `GET /health`: `stt, vad, lexicon, llm, voice, verify, alerts, storage`

## Events

Every event uses the envelope `{v, type, session_id, seq, ts, payload}`.
`type` is one of `utterance | coercion | entities | risk | alert | status`.

- **`status`:** `{component, status, detail}`. `component="session"` uses `started` and `ended`.
- **`utterance`:**
  - Always present: `utterance_id`, `t_start_s`, `t_end_s` (call time), `end_reason`, `speech_ms`,
    `stt_status`.
  - `stt_status` is one of `ok | unavailable | timeout | dropped | error`.
  - When `stt_status=ok`: `text`, `lang`, `detected_language`, `lang_probs`, `stt_latency_ms`,
    `inference_ms`, `stt_model`, `avg_logprob`, `no_speech_prob`.
  - When it isn't `ok`, `text` is `null` and is never guessed.
- **`coercion`, `entities`, `risk`, `alert`:** defined in B3 and B4. Update this section when they land.

## STT facts that shape later milestones (B2 benchmark, Apple M3, synthetic TTS)

- **Model choice.** `base` writes Hindi in Urdu script, so it's unusable for the lexicon. `small`
  writes Devanagari.
  - Language ID with `small` costs about 1 s per utterance; with `tiny` it costs about 0.1 s.
  - 4 CPU threads beat 8, because the extra threads land on efficiency cores.
- **Hinglish comes out in Devanagari.** Whisper transcribes romanized Hinglish speech in
  Devanagari, including English words ("सेफ अकाउंट", "वेरिफिकेशन", "क्राइम ब्रांच").
  - The B3 lexicon needs English, Devanagari Hindi, romanized Hinglish **and Devanagari
    transliterations of English terms**.
  - Matching must be fuzzy, because spellings drift ("मैद बताइए" for "मत बताइए").
- **Forced English can translate.** When language ID picks `en` for Hindi speech, Whisper sometimes
  *translates* it to English instead of transcribing. The coercion engine must work on English
  paraphrases too.

## Commands (run from `backend/`)

```bash
make setup                 # venv (python3.11) + deps + .env from .env.example
make run                   # server on HOST:PORT; STT warms up in the background (/health shows loading -> ok)
make test                  # pytest (never loads Whisper; uses fakes)
make lint / make fmt       # ruff
make test-audio            # render tests/audio_scripts/*.yaml -> samples/synthetic_tts/*.wav (+ .json timings)
make bench-stt             # benchmark tiny/base/small on this machine
make stt-report            # live: stream all synthetic WAVs through the running server, WER + latency
make demo-wav FILE=...     # stream any audio file in real time and print events
```

## Working rules for agents

- Before putting a number in code, put it in `.env`/settings or a YAML config.
- A new signal or rule needs a unit test **and** must appear in risk `contributions`.
- A new external call needs a timeout, `status` reporting, and a test for the unavailable path.
- Keep upload, live call and test paths identical downstream of `/ws/audio`.
- Commit messages: imperative and scoped (`coercion: add isolation cues for hi`).
- To stop a server you started, use `kill $(lsof -tnP -iTCP:8000 -sTCP:LISTEN)`. `pkill -f "python -m app"`
  misses it, because macOS reports the process as `Python`.
