"""CoercionEngine: lexicon hits per utterance + call-level sequence scoring.

An optional LLM tagger can add hits for paraphrases the lexicon misses. It is behind the
`CoercionTagger` interface and off until the LLM milestone (`LLM_ENABLED=false`).
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
    llm_status: str


class CoercionEngine:
    def __init__(
        self,
        lexicon: Lexicon,
        cfg: CoercionConfig,
        levels: Levels,
        tagger: CoercionTagger | None = None,
        tagger_timeout_s: float = 2.0,
    ) -> None:
        self.lexicon = lexicon
        self.cfg = cfg
        self.levels = levels
        self.tagger = tagger
        self.tagger_timeout_s = tagger_timeout_s

    @classmethod
    def load(cls, tagger: CoercionTagger | None = None) -> CoercionEngine:
        weights = load_weights()
        return cls(
            Lexicon.load(MatchConfig.from_dict(weights["matching"])),
            CoercionConfig.from_weights(weights),
            Levels.from_weights(weights),
            tagger,
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
        sources = {id(h): "lexicon" for h in hits}

        llm_status = "disabled"
        if engine.tagger is not None:
            try:
                extra = await asyncio.wait_for(
                    engine.tagger.tag(text, normalized), engine.tagger_timeout_s
                )
                hits += extra
                sources.update({id(h): "llm" for h in extra})
                llm_status = "ok"
            except TimeoutError:
                llm_status = "timeout"
            except Exception:
                log.exception("coercion tagger failed")
                llm_status = "error"

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
                    source=sources[id(h)],
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
            llm_status=llm_status,
        )
