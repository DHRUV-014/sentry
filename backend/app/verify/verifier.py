"""Claim verification interface. TinyFish is added later; until then verification is unavailable.

Only extracted entities (kind + value) ever cross this boundary, never audio or transcripts.
"""

from __future__ import annotations

from typing import Literal, Protocol

from pydantic import BaseModel

from app.events import ComponentStatus

Verdict = Literal["match", "mismatch", "reported_scam", "unknown"]


class VerificationQuery(BaseModel):
    kind: str
    value: str


class VerificationSource(BaseModel):
    url: str
    title: str = ""


class VerificationResult(BaseModel):
    query: VerificationQuery
    verdict: Verdict
    sources: list[VerificationSource] = []
    official_contact: str | None = None


class Verifier(Protocol):
    name: str

    def status(self) -> tuple[ComponentStatus, str]: ...

    async def verify(self, query: VerificationQuery) -> VerificationResult | None:
        """Returns None when verification could not be performed."""
        ...


class UnavailableVerifier:
    name = "none"

    def status(self) -> tuple[ComponentStatus, str]:
        return ComponentStatus.UNAVAILABLE, "no verification provider configured"

    async def verify(self, query: VerificationQuery) -> VerificationResult | None:
        return None
