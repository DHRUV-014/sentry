"""CoercionEngine: lexicon hits per utterance + call-level sequence scoring.

Two optional taggers add hits for phrasings the lexicon misses, both behind the `CoercionTagger`
interface and each with its own timeout and status:
  - `model`: our trained tactic classifier (app/coercion/model_tagger.py)
  - `tagger`: an LLM tagger, off until the LLM milestone (`LLM_ENABLED=false`)
"""

from __future__ import annotations

import asyncio
import logging
from typing import Protocol

from pydantic import BaseModel

from app.coercion.lexicon import PROTECTIVE, Hit, Lexicon, MatchConfig
from app.coercion.sequence import (
    ChainStep,
    CoercionConfig,
    Contribution,
    SequenceTracker,
)
from app.risk.levels import Level, Levels, load_weights
from app.text.normalize import NormalizedText, normalize

log = logging.getLogger(__name__)


class CoercionTagger(Protocol):
    """Adds tactic hits for an utterance (e.g. an LLM with strict JSON output)."""

    async def tag(self, text: str, normalized: NormalizedText) -> list[Hit]: ...


async def _run_tagger(
    tagger: CoercionTagger | None, text: str, normalized: NormalizedText, budget_s: float
) -> tuple[list[Hit], str]:
    """Hits and status (`disabled | ok | timeout | error`). A failure never fails the utterance."""
    if tagger is None:
        return [], "disabled"
    try:
        return await asyncio.wait_for(tagger.tag(text, normalized), budget_s), "ok"
    except TimeoutError:
        return [], "timeout"
    except Exception:
        log.exception("coercion tagger %s failed", type(tagger).__name__)
        return [], "error"


class HitOut(BaseModel):
    tactic: str
    pattern: str
    span: str  # original transcript text
    weight: float
    confidence: float
    score: float
    negated: bool
    source: str = "lexicon"


class CoercionResult(BaseModel):
    utterance_id: str
    hits: list[HitOut]
    score: float
    raw_score: float
    level: Level
    tactic_strengths: dict[str, float]
    stages_reached: list[int]
    chain: list[ChainStep]
    ordered: bool
    protective_strength: float
    caps_applied: list[str]
    contributions: list[Contribution]
    model_status: str
    llm_status: str


class CoercionEngine:
    def __init__(
        self,
        lexicon: Lexicon,
        cfg: CoercionConfig,
        levels: Levels,
        tagger: CoercionTagger | None = None,
        tagger_timeout_s: float = 2.0,
        model: CoercionTagger | None = None,
        model_timeout_s: float = 1.0,
    ) -> None:
        self.lexicon = lexicon
        self.cfg = cfg
        self.levels = levels
        self.tagger = tagger
        self.tagger_timeout_s = tagger_timeout_s
        self.model = model
        self.model_timeout_s = model_timeout_s

    @classmethod
    def load(
        cls,
        tagger: CoercionTagger | None = None,
        model: CoercionTagger | None = None,
        model_timeout_s: float = 1.0,
    ) -> CoercionEngine:
        weights = load_weights()
        return cls(
            Lexicon.load(MatchConfig.from_dict(weights["matching"])),
            CoercionConfig.from_weights(weights),
            Levels.from_weights(weights),
            tagger,
            model=model,
            model_timeout_s=model_timeout_s,
        )

    def describe(self) -> str:
        tactics = self.lexicon.tactics
        n = sum(1 for p in self.lexicon.patterns if p.category != PROTECTIVE)
        return f"{n} patterns, {len(tactics)} tactics + protective cues"

    def new_call(self) -> CallCoercion:
        return CallCoercion(self)


class CallCoercion:
    """Per-call coercion state."""

    def __init__(self, engine: CoercionEngine) -> None:
        self._engine = engine
        self._tracker = SequenceTracker(engine.cfg)

    async def process(
        self,
        utterance_id: str,
        t_s: float,
        text: str,
        normalized: NormalizedText | None = None,
        verification_mismatch: bool = False,
    ) -> CoercionResult:
        engine = self._engine
        normalized = normalized or normalize(text)
        hits = engine.lexicon.match(normalized)
        model_hits, model_status = await _run_tagger(
            engine.model, text, normalized, engine.model_timeout_s
        )
        llm_hits, llm_status = await _run_tagger(
            engine.tagger, text, normalized, engine.tagger_timeout_s
        )
        hits = [*hits, *model_hits, *llm_hits]

        snap = self._tracker.update(utterance_id, t_s, hits, verification_mismatch)
        return CoercionResult(
            utterance_id=utterance_id,
            hits=[
                HitOut(
                    tactic=h.category,
                    pattern=h.pattern,
                    span=h.span,
                    weight=h.weight,
                    confidence=h.confidence,
                    score=round(h.score, 4),
                    negated=h.negated,
                    source=h.source,
                )
                for h in hits
            ],
            score=snap.score,
            raw_score=snap.raw_score,
            level=engine.levels.of(snap.score),
            tactic_strengths=snap.tactic_strengths,
            stages_reached=snap.stages_reached,
            chain=snap.chain,
            ordered=snap.ordered,
            protective_strength=snap.protective_strength,
            caps_applied=snap.caps_applied,
            contributions=snap.contributions,
            model_status=model_status,
            llm_status=llm_status,
        )
