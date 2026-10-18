"""Per-call text analysis run on every transcribed utterance: coercion scoring + entity extraction."""

from __future__ import annotations

from pydantic import BaseModel

from app.coercion.engine import CallCoercion, CoercionEngine, CoercionResult
from app.entities.extract import Entity, EntityExtractor
from app.text.normalize import normalize


class EntitiesPayload(BaseModel):
    utterance_id: str
    entities: list[Entity]
    # Every distinct claim the caller has made so far in this call (used for alerts/verification).
    claims_so_far: list[Entity]


class CallAnalyzer:
    def __init__(self, engine: CoercionEngine, extractor: EntityExtractor) -> None:
        self._coercion: CallCoercion = engine.new_call()
        self._extractor = extractor
        self._claims: dict[tuple[str, str], Entity] = {}

    async def analyze(
        self, utterance_id: str, t_s: float, text: str
    ) -> tuple[CoercionResult, EntitiesPayload | None]:
        normalized = normalize(text)
        coercion = await self._coercion.process(utterance_id, t_s, text, normalized)
        entities = self._extractor.extract(text, normalized)
        if not entities:
            return coercion, None
        for e in entities:
            self._claims.setdefault((e.kind, e.value), e)
        return coercion, EntitiesPayload(
            utterance_id=utterance_id,
            entities=entities,
            claims_so_far=list(self._claims.values()),
        )
