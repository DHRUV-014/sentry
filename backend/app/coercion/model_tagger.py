"""Trained coercion-tactic classifier (ONNX, int8) as a `CoercionTagger` next to the lexicon.

The model is built by `make train-coercion` into models/coercion/ (git-ignored):
model.onnx, tokenizer.json and model.json (labels, per-tactic thresholds, input mode). It reads one
caller utterance and outputs a probability per tactic. Every tactic that clears its tuned threshold
becomes a hit with `source="model"` and score = weight × probability (weight from
app/risk/weights.yaml), so the sequence tracker, caps and contributions treat it like any other
evidence. Inference runs in a dedicated single worker thread; the engine applies the timeout.
"""

from __future__ import annotations

import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from app.coercion.lexicon import Hit
from app.config import BACKEND_DIR
from app.text.normalize import NormalizedText, normalize

MODEL_DIR = BACKEND_DIR / "models" / "coercion"
REQUIRED_FILES = ("model.onnx", "tokenizer.json", "model.json")


class ModelUnavailable(Exception):
    pass


@dataclass
class TacticModel:
    """Tokenizer + ONNX session + metadata. Synchronous; callers run it off the event loop."""

    session: object
    tokenizer: object
    labels: list[str]
    thresholds: dict[str, float]
    input_mode: str  # "raw" = original text, "norm" = normalize(text).text
    prefix: str
    run: str

    @classmethod
    def load(cls, model_dir: Path = MODEL_DIR, threads: int = 1) -> TacticModel:
        missing = [f for f in REQUIRED_FILES if not (model_dir / f).exists()]
        if missing:
            raise ModelUnavailable(f"missing {', '.join(missing)} in {model_dir}")
        import onnxruntime as ort
        from tokenizers import Tokenizer

        meta = json.loads((model_dir / "model.json").read_text(encoding="utf-8"))
        tokenizer = Tokenizer.from_file(str(model_dir / "tokenizer.json"))
        tokenizer.enable_truncation(max_length=int(meta["max_len"]))
        tokenizer.no_padding()
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = threads
        opts.inter_op_num_threads = 1
        session = ort.InferenceSession(
            str(model_dir / "model.onnx"), opts, providers=["CPUExecutionProvider"]
        )
        return cls(
            session=session,
            tokenizer=tokenizer,
            labels=list(meta["labels"]),
            thresholds={k: float(v) for k, v in meta["thresholds"].items()},
            input_mode=meta["input"],
            prefix=meta["encoder"].get("prefix", ""),
            run=meta.get("run", "?"),
        )

    def probs(self, text: str, normalized: NormalizedText | None = None) -> list[float]:
        if self.input_mode == "norm":
            text = (normalized or normalize(text)).text
        enc = self.tokenizer.encode(self.prefix + text)
        ids = np.array([enc.ids], dtype=np.int64)
        mask = np.array([enc.attention_mask], dtype=np.int64)
        (logits,) = self.session.run(["logits"], {"input_ids": ids, "attention_mask": mask})
        return (1.0 / (1.0 + np.exp(-logits[0]))).tolist()


class ModelTagger:
    """`CoercionTagger` backed by `TacticModel`."""

    source = "model"

    def __init__(self, model: TacticModel, weight: float) -> None:
        self.model = model
        self.weight = weight
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="coercion-model")

    def describe(self) -> str:
        return f"{self.model.run}, {len(self.model.labels)} tactics"

    def hits(self, text: str, normalized: NormalizedText | None = None) -> list[Hit]:
        normalized = normalized or normalize(text)
        probs = self.model.probs(text, normalized)
        last = max(0, len(normalized.tokens) - 1)
        return [
            Hit(
                category=tactic,
                pattern_id=f"model:{tactic}",
                pattern=f"classifier p={p:.2f} (threshold {self.model.thresholds[tactic]:.2f})",
                weight=self.weight,
                confidence=round(p, 4),
                first_token=0,
                last_token=last,
                span=text,
                source=self.source,
            )
            for tactic, p in zip(self.model.labels, probs, strict=True)
            if p >= self.model.thresholds[tactic]
        ]

    async def tag(self, text: str, normalized: NormalizedText) -> list[Hit]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, self.hits, text, normalized)

    def close(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
