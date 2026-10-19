# Progress: Scam Shield backend

Last updated: 2026-10-19, during B3.5. CLAUDE.md has the principles, build order and rules; this
file tracks where the work stands.

## Hard rule: held-out data

**`eval/human/` stays unread** (no open, read, list, grep or summary, by any agent or subagent)
until the user says **"training frozen"**. It holds the team-written held-out test sets
(`test_human.jsonl`, `test_handwritten.jsonl`, `conversations_human.yaml`, `VALIDATION.md`).

Two places enforce this:
- the deny-list section in CLAUDE.md
- `.claude/settings.json`

Training, threshold tuning and model selection never touch it.

## Done (committed)

| Milestone | Commit | What |
|---|---|---|
| B1 | 2ef17bd | config, events, bus, sessions, `/health`, SQLite |
| B2 | 1e069b2 | audio ingest, VAD, faster-whisper `small` + `tiny` language ID |
| B2.1 | 5b2278d | never translate, Hindi fallback, warm-up gate, `app/text/normalize.py` |
| B3 | 0e07ac2 | lexicon + escalation chain + caps; entity extraction |

## B3.5: coercion classifier (in progress)

### Decisions

- **Data source: Option A**, an LLM writes the utterances. The generator is isolated Claude Code
  subagents (`claude-opus-5-5`).
  - Six ran in parallel, two per language, all with identical instructions.
  - Each was allowed to read only `training/coercion/generator_instructions.md` and its batch
    prompts.
  - None of them read `app/coercion/`, `lexicon.yaml`, `tests/` or `eval/human/`.
- **Labels** (multi-label): AUTHORITY, THREAT, URGENCY, SECRECY, ISOLATION, PAYMENT, CREDENTIAL,
  plus BENIGN, which is exclusive.
  - **Video-call rule:** being asked to join or stay on a video call is SECRECY or ISOLATION,
    never CREDENTIAL.
  - Full definitions are in `training/coercion/generator_instructions.md`; the data is described in
    `training/coercion/DATA.md`.
- **Prompts:** 33 batches of 100 rows, 11 per language (en / hi Devanagari / hinglish romanized).
  - Mix: 45 scam, 30 hard negatives, 25 chat.
  - Every row records `prompt_id`, `prompt_hash` and `generator`.
- **Near-duplicates:** rows above 0.75 similarity (rapidfuzz ratio on `normalize_key`) are
  removed.
- **Noisy copy:** a stratified sample of 1,000 rows was rendered with `say` and transcribed by
  calling `FasterWhisperProvider.transcribe_blocking` directly, with the same model, settings and
  language rules as live (no real-time streaming).
  - The rows are normalized and tagged `source=stt_noisy`.
  - Each keeps its source row's labels and `prompt_id`.
  - Audio exists only in a temp dir.
- **Split** by prompt id: `VAL_PROMPTS = p07 p08 p09 p22 p23 p24`, two batches per language. A
  noisy row follows its source's prompt.
- **Model:**
  - Architecture: encoder, then mean pooling, then 7 sigmoid outputs. Input is the caller
    utterance only, because the live pipeline hears only the caller.
  - Training: head learning rate 1e-3, encoder 5e-5, 10 epochs.
  - Selection: best epoch by val macro-F1 at 0.5, then per-tactic thresholds tuned on val (max
    F1). Because both are chosen on val, **val metrics are optimistic**.
- **Encoders**, verified on Hugging Face and pinned to a commit:
  - `intfloat/multilingual-e5-small` (MIT)
  - `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (Apache-2.0)
  - Each is trained on original text (`raw`) and on normalized text (`norm`).
- **Deployment:**
  - The model is exported to ONNX and quantized to int8. Thresholds are re-tuned on the int8
    model's own val scores.
  - The app needs only `onnxruntime` and `tokenizers`; torch and transformers are a `[train]`
    extra.
- **Integration:**
  - `app/coercion/model_tagger.py` runs behind `CoercionEngine` as the `model` slot, in its own
    worker thread, with a 1.0 s timeout.
  - A hit's score is weight × probability; the weight is `model_tagger.weight` (0.8) in
    `weights.yaml`.
  - The caps still apply. Status is reported as `classifier` on `/health` and as `model_status` on
    coercion events.
  - A missing model shows as "unavailable"; the lexicon then runs alone.

### Data counts

**Generated:** 3,300 valid rows, all passed validation. 22 near-duplicates were removed (one with
a label conflict), leaving **3,278**.

| | Count |
|---|---|
| By language: en / hi / hinglish | 1,096 / 1,091 / 1,091 |
| By category: scam / hard_negative / chat | 1,477 / 977 / 824 |
| AUTHORITY / THREAT / URGENCY | 332 / 420 / 274 |
| SECRECY / ISOLATION | 218 / 265 |
| PAYMENT / CREDENTIAL | 396 / 204 |
| BENIGN | 1,965 |
| Multi-label rows | 658 |
| Rows with spoken-style noise | 1,073 |

Some generators reached the noise and context quotas with patch scripts, so part of the noise is
formulaic.

**STT-noised:** 1,000 rows (334 en / 333 hi / 333 hinglish), none empty. Normalized WER against
the source text:

| Language | Normalized WER |
|---|---|
| English | 12.6% |
| Hindi | 37.0% |
| Hinglish | 54.0% |

The run averaged 4.7 s per row, slowed down by macOS background services competing for the CPU.

### Preliminary results

These runs trained on clean text only, before the noisy copy existed:

| Run | Val macro-F1 |
|---|---|
| e5-small, original text | 0.709 |
| MiniLM-L12, original text | 0.760 |
| MiniLM-L12, original text, int8 | 0.746 |

The int8 model's latency is 17.8 ms median and 23.3 ms p95 per utterance on CPU with 1 thread.

### Files

- `training/coercion/`
  - `DATA.md`, `generator_instructions.md`
  - `make_prompts.py`, `prompts/`
  - `generated/` (raw LLM batches)
  - `build_dataset.py`, `data/dataset.jsonl`, `data/counts.json`
  - `make_noisy.py`, `data/stt_noisy.jsonl`
  - `train.py`, `compare.py`, `export.py`, `rebuild.sh`
- `models/coercion/` (git-ignored): `model.onnx`, `tokenizer.json`, `model.json`, `metrics.json`,
  and `runs/<run>/`
- `app/coercion/model_tagger.py`
- `tests/test_model_tagger.py`
- `make setup-train`, `make train-coercion`
- `tools/coercion_report.py --model`

### Left in B3.5

1. Finish the 4 final runs (clean + noisy) and the clean-only run of the same configuration, then
   compare them.
2. Export the best run, re-tune thresholds on the int8 model, and measure latency.
3. Confirm on 20 rows that direct STT matches the streaming (WebSocket + VAD) path.
4. Run `make coercion-report` with and without `--model` on the fixtures and the live run.
5. Report val metrics and latency to the user and **stop**.
6. After "training frozen": evaluate on `eval/human/` and commit B3.5.
