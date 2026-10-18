"""Benchmark faster-whisper model sizes on this machine and recommend one.

Each WAV is cut into utterances with the server's own VAD segmenter, then every model transcribes
the same segments (same settings as the server: int8 CPU, language restricted to STT_LANGUAGES).
Reports per-utterance inference latency and WER against the script text, and picks the largest
model whose p95 latency stays under --budget-ms.

Usage: python -m tools.bench_stt [--models tiny base small] [--dir ../samples/synthetic_tts]
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np

from app.audio.buffer import FRAME_BYTES, SAMPLE_RATE
from app.audio.stt import FasterWhisperProvider
from app.audio.vad import VadConfig, VadSegmenter, WebRtcVad
from app.config import get_settings
from tools.make_test_audio import DEFAULT_OUT
from tools.stream_wav import load_pcm16k
from tools.wer import Report, format_table, score


def segment_file(path: Path, settings) -> list:
    segmenter = VadSegmenter(
        VadConfig.from_settings(settings), WebRtcVad(settings.vad_aggressiveness)
    )
    pcm = load_pcm16k(path)
    segments = []
    for i in range(0, len(pcm) - len(pcm) % FRAME_BYTES, FRAME_BYTES):
        seg = segmenter.push(pcm[i : i + FRAME_BYTES])
        if seg is not None:
            segments.append(seg)
    last = segmenter.flush()
    if last is not None:
        segments.append(last)
    return segments


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--models", nargs="+", default=["tiny", "base", "small"])
    parser.add_argument("--dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--budget-ms", type=float, default=2000)
    args = parser.parse_args()

    settings = get_settings()
    files = sorted(args.dir.glob("synthetic_*.wav"))
    if not files:
        raise SystemExit(f"no synthetic_*.wav in {args.dir}; run `make test-audio` first")
    corpus = [
        (
            f,
            json.loads(f.with_suffix(".json").read_text(encoding="utf-8")),
            segment_file(f, settings),
        )
        for f in files
    ]
    n_segments = sum(len(s) for _, _, s in corpus)
    audio_s = sum(len(seg.pcm) for _, _, segs in corpus for seg in segs) / SAMPLE_RATE
    print(f"{len(files)} files, {n_segments} VAD utterances, {audio_s:.1f}s of speech\n")

    results = {}
    for size in args.models:
        provider = FasterWhisperProvider.from_settings(settings, model_size=size)
        t_load = time.perf_counter()
        provider.transcribe_blocking(np.zeros(SAMPLE_RATE, dtype=np.int16))  # load + warm-up
        load_s = time.perf_counter() - t_load

        latencies, durations, report = [], [], Report()
        for _, manifest, segments in corpus:
            utts = []
            for seg in segments:
                tr = provider.transcribe_blocking(seg.pcm)
                latencies.append(tr.inference_ms)
                durations.append(len(seg.pcm) / SAMPLE_RATE)
                utts.append((seg.start_s, seg.end_s, tr.text))
            report.extend(score(manifest, utts))
        lat = np.array(latencies)
        results[size] = {
            "load_s": load_s,
            "median_ms": float(np.median(lat)),
            "p95_ms": float(np.percentile(lat, 95)),
            "max_ms": float(lat.max()),
            "rtf": float(lat.sum() / 1000 / sum(durations)),
            "wer": report.by_lang(),
        }
        r = results[size]
        print(
            f"== {size}: load+warmup {r['load_s']:.1f}s | per-utterance median {r['median_ms']:.0f} ms, "
            f"p95 {r['p95_ms']:.0f} ms, max {r['max_ms']:.0f} ms | RTF {r['rtf']:.2f}"
        )
        print(format_table(r["wer"]))
        print()

    within = [m for m in args.models if results[m]["p95_ms"] <= args.budget_ms]
    pick = within[-1] if within else None
    print(f"budget: p95 <= {args.budget_ms:.0f} ms per utterance")
    print(f"recommended STT_MODEL={pick}" if pick else "no model meets the budget")


if __name__ == "__main__":
    main()
