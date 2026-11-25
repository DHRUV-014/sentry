# Sentry

Real-time scam detection for voice calls. Sentry transcribes the caller, detects coercion tactics, verifies the caller's claims against official sources via TinyFish, and alerts a trusted contact when risk is high.

## Features

- **Live call analysis** (`/demo`): streams audio from the microphone or a WAV file through speech-to-text and a tactic classifier. Displays risk score, level, timeline, tactic chain and transcript.
- **Explainable risk**: every score change includes the triggering words, the tactic and a reason in English and Hindi.
- **Caller verification** (`/check`): looks up the claimed institution's official helpline, government advisories and public fraud reports using TinyFish, with source links.
- **Alerts**: dashboard alert on the first HIGH or CRITICAL level; email alerts to a consenting trusted contact via Resend.
- **Auth and onboarding**: Firebase email/password and Google sign-in; onboarding collects user details and one trusted contact.

## Risk model

Detected tactics: `AUTHORITY`, `THREAT`, `URGENCY`, `SECRECY`, `ISOLATION`, `PAYMENT`, `CREDENTIAL`.

| Level | Score |
|---|---|
| LOW | < 0.30 |
| MEDIUM | 0.30 – 0.55 |
| HIGH | 0.55 – 0.80 |
| CRITICAL | ≥ 0.80 |

Rules:
- A single keyword cannot reach HIGH.
- CRITICAL requires `PAYMENT` or `CREDENTIAL` plus `THREAT`, `SECRECY` or a verification mismatch.
- Protective phrases (e.g. "never share your OTP") reduce risk.
- Evidence decays with a 90 s half-life; level changes use hysteresis.

Configuration: `backend/app/risk/weights.yaml`.

## Architecture

```
Mic / WAV → AudioWorklet (16 kHz mono, 20 ms frames) → WS /ws/audio/{id}
  → VAD (webrtcvad)
  → STT (faster-whisper small; tiny for language ID)
  → text normalisation (English, Hindi, Hinglish)
  → coercion engine (ONNX classifier + lexicon + escalation chain)
  → entity extraction (phone, UPI ID, URL, institution)
  → risk fusion → WS /ws/events/{id} → alerts
```

The classifier is `intfloat/multilingual-e5-small` fine-tuned on ~3,300 generated English, Hindi and Hinglish utterances plus 1,000 STT-noised copies, exported to ONNX. Details: `backend/training/coercion/DATA.md`, `PROGRESS.md`.

## TinyFish integration

- **Search** finds official contact pages, advisories and fraud reports, restricted to trusted domains.
- **Fetch** retrieves those pages as text to extract official phone numbers for comparison.

Only institutions listed in `backend/app/verify/sources.yaml` are searched, on domains confirmed by an official registry (RBI, gov.in/nic.in, CBIC, TRAI).

TinyFish receives only an institution name, phone number, UPI ID or URL. It never receives audio, transcripts or user details. Results are cached for 24 hours.

## Stack

| Layer | Technologies |
|---|---|
| Backend | Python 3.11, FastAPI, WebSockets, pydantic, SQLite |
| Audio / ML | webrtcvad, faster-whisper, ONNX Runtime, tokenizers, rapidfuzz |
| Verification | TinyFish Search and Fetch |
| Alerts | Resend (email) |
| Frontend | React, Vite, TypeScript, Tailwind CSS, Motion |
| Auth / data | Firebase Authentication, Firestore |

## Setup

### Requirements

- Python 3.11
- Node.js 18+
- Firebase project, or the Firebase emulators
- Optional: TinyFish API key, Resend API key

### Backend

```bash
cd backend
make setup                     # venv, dependencies, .env from .env.example
# non-Homebrew systems:
make setup PYTHON=python3.11
```

Set in `backend/.env`:

| Variable | Purpose |
|---|---|
| `TINYFISH_API_KEY` | Enables verification |
| `RESEND_API_KEY`, `EMAIL_ALERT_FROM` | Enables email alerts |
| `ELDER_NAME` | Name used in alert actions |
| `STORE_TRANSCRIPTS` | `false` redacts stored transcripts |

The classifier model is not committed. Build it with:

```bash
make setup-train
make train-coercion
```

Without it, the engine runs in lexicon-only fallback mode and `/health` reports `degraded`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env           # fill in VITE_FIREBASE_* values
```

Firebase console:
1. Authentication: enable Email/Password and Google.
2. Firestore: create a database.
3. Firestore Rules: publish `frontend/firestore.rules`.

For local development without Firebase, run `npm run emulators` and use the emulator values in `frontend/.env.example`.

### Run

```bash
make demo
```

Starts the backend, waits for model warm-up, starts the frontend and opens `http://localhost:5173/demo`. See [DEMO.md](DEMO.md) for test scripts.

## Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/auth` | Sign in / sign up |
| `/onboarding` | User details and trusted contact |
| `/dashboard` | Home |
| `/demo` | Live and recorded call analysis |
| `/check` | Caller verification |

## API

| Endpoint | Description |
|---|---|
| `POST /sessions` | Create a session |
| `WS /ws/audio/{id}` | Audio input (16 kHz mono int16, 20 ms frames) |
| `WS /ws/events/{id}` | Events: `utterance`, `coercion`, `entities`, `risk`, `alert`, `status` |
| `POST /sessions/{id}/end` | End a session |
| `GET /verify/institutions` | Trusted institution list |
| `POST /verify/manual` | Caller verification |
| `GET /health` | Component status |

Event schemas: [CLAUDE.md](CLAUDE.md).

## Commands

Backend (`backend/`):

```bash
make run                      # API server
make test                     # tests
make lint                     # ruff
make demo-wav FILE=call.wav   # stream a file, print events
make coercion-report          # risk trajectories on test conversations
make prewarm-verify           # cache TinyFish results
make check-sources            # validate bank domains against RBI
make bench-stt                # STT benchmark
```

Frontend (`frontend/`):

```bash
npm run dev
npm run typecheck
npm run test:rules            # Firestore rules tests (emulator)
```

## Privacy

- Audio is held in memory only and never written to disk.
- External verification receives extracted entities only.
- Missing components are reported as unavailable; no scores are simulated.
- Trusted contacts require recorded consent; alert emails exclude transcript text.
- Firestore rules restrict each user to their own document and an allow-listed set of fields.
- Secrets are loaded from git-ignored `.env` files.

## Limitations

- Runs on browser (VoIP) calls. Standard cellular calls cannot be accessed by apps.
- Voice-clone detection is not implemented.
- Verification is available on `/check` only, not yet during live calls.
- SMS and WhatsApp alerts are not implemented.
- Backend endpoints do not yet verify Firebase ID tokens.
- The classifier is trained on generated data; validation metrics are optimistic. A human-written held-out set is reserved for final evaluation.
