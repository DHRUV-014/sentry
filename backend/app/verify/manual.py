"""Manual "Check this caller": what the person reports + online verification -> risk + next steps.

Risk uses the same machinery as live calls: each reported request ("asked for an OTP") is one
piece of tactic evidence in a CallCoercion (caps, chain and CRITICAL gate apply), an optional
pasted message runs through the coercion classifier (experimental: it was trained on call
speech), then verification verdicts are combined by `apply_verification` (verification alone can
never reach HIGH).

Privacy: TinyFish only ever receives the institution (and only when it resolves to an entry in
sources.yaml), the phone, the UPI ID and the URL. Personal names, the message text and anything
about the elder are never sent.
"""

from __future__ import annotations

import asyncio
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.coercion.engine import CoercionEngine
from app.coercion.lexicon import Hit
from app.entities.extract import Entity, EntityExtractor
from app.risk.fusion import (
    CallRisk,
    FusionConfig,
    Reason,
    apply_verification,
    load_reasons,
)
from app.risk.levels import Level, load_weights
from app.verify.inputs import normalize_phone, normalize_upi, normalize_url
from app.verify.verifier import CheckResult, Verifier

IdentityType = Literal[
    "bank", "police", "government", "courier", "telecom", "company", "relative", "other"
]
AskedTo = Literal["otp", "money", "video_call", "secrecy", "install_app", "go_alone"]
SEARCHABLE_TYPES = {"bank", "police", "government", "courier", "telecom", "company"}


class ManualCheckRequest(BaseModel):
    claimed_identity_type: IdentityType
    claimed_identity_name: str = Field("", max_length=80)
    phone: str | None = Field(None, max_length=24)
    upi: str | None = Field(None, max_length=320)
    url: str | None = Field(None, max_length=2048)
    asked_to: list[AskedTo] = []
    message_text: str | None = Field(None, max_length=2000)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        n = normalize_phone(v)
        if n is None:
            raise ValueError(
                "phone must be a 10-digit Indian number, toll-free 1800/1860, or E.164"
            )
        return n

    @field_validator("upi")
    @classmethod
    def _upi(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        n = normalize_upi(v)
        if n is None:
            raise ValueError("upi must look like name@bank")
        return n

    @field_validator("url")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        n = normalize_url(v)
        if n is None:
            raise ValueError("url must be a public http(s) web address")
        return n


class TextAnalysis(BaseModel):
    label: dict[str, str]  # "experimental: model trained on call speech"
    mode: str  # model | lexicon_fallback
    tactics: list[str]
    model_probs: dict[str, float] | None


class ManualCheckResponse(BaseModel):
    level: Level
    score: float
    tactics: list[str]
    top_reasons: list[Reason]
    contributions: list
    verification_capped: bool
    institution: str | None
    checks: list[CheckResult]
    text_analysis: TextAnalysis | None
    next_steps: list[dict[str, str]]
    verification_status: str


async def run_manual_check(
    req: ManualCheckRequest,
    engine: CoercionEngine,
    extractor: EntityExtractor,
    verifier: Verifier | None,
    budget_s: float,
) -> ManualCheckResponse:
    weights = load_weights()["manual_check"]
    texts = load_reasons()
    cfg = FusionConfig.load()

    # Resolve the claimed institution to a canonical, listed name (never a personal name).
    institution: str | None = None
    claims: list[Entity] = []
    if req.claimed_identity_type in SEARCHABLE_TYPES and req.claimed_identity_name.strip():
        found = [e for e in extractor.extract(req.claimed_identity_name) if e.kind == "institution"]
        if found:
            institution = found[0].value
            claims.append(found[0])

    # Verification (in parallel, bounded).
    checks: list[CheckResult] = []
    if verifier is not None:
        jobs = []
        if req.claimed_identity_type in SEARCHABLE_TYPES and req.claimed_identity_name.strip():
            jobs.append(
                verifier.institution_contact(institution or req.claimed_identity_name, req.phone)
            )
        jobs.append(verifier.advisory(req.claimed_identity_type, list(req.asked_to)))
        for kind, value in (("phone", req.phone), ("upi", req.upi), ("url", req.url)):
            if value:
                jobs.append(verifier.public_reports(kind, value))
        try:
            checks = list(await asyncio.wait_for(asyncio.gather(*jobs), budget_s))
        except TimeoutError:
            checks = []
    verdicts = [c.verdict for c in checks if c.status == "ok"]
    mismatch = next(
        (c for c in checks if c.check == "institution_contact" and c.verdict == "MISMATCH"), None
    )

    # Tactic evidence: the reported requests, the claimed authority, and optionally the message.
    call = engine.new_call()
    text_analysis = None
    if req.message_text and req.message_text.strip():
        r = await call.process("message", 0.0, req.message_text)
        text_analysis = TextAnalysis(
            label={
                "en": "Experimental: this model was trained on call speech, not written messages.",
                "hi": "प्रायोगिक: यह मॉडल कॉल की बातचीत पर सिखाया गया है, लिखे संदेशों पर नहीं।",
            },
            mode=r.mode,
            tactics=sorted({h.tactic for h in r.hits if h.counted and h.score > 0}),
            model_probs=r.model_probs,
        )
    evidence: list[tuple[str, str]] = [(f"asked:{a}", weights["asked_to"][a]) for a in req.asked_to]
    if req.claimed_identity_type in weights["authority_identity_types"]:
        evidence.insert(0, ("identity", "AUTHORITY"))
    result = None
    for i, (uid, tactic) in enumerate(evidence):
        hit = Hit(
            category=tactic,
            pattern_id=f"form:{uid}",
            pattern=f"reported by user: {uid}",
            weight=float(weights["form_weight"]),
            confidence=1.0,
            first_token=0,
            last_token=0,
            span=uid,
            source="form",
        )
        result = await call.add_evidence(f"form:{uid}", float(i), [hit], mismatch is not None)
    if result is None:  # nothing reported: score whatever the message gave (or nothing)
        result = await call.add_evidence("form:none", 0.0, [], mismatch is not None)

    risk = CallRisk(cfg).update(result, 0.0, claims, {"verify": "manual"})
    score, verify_contribs, capped = apply_verification(
        risk.score, len(result.tactic_strengths), verdicts, cfg
    )
    level = cfg.levels.of(score)

    reasons = list(risk.top_reasons)
    vt = texts["verify"]
    if mismatch is not None:
        name = institution or req.claimed_identity_name
        reasons.insert(0, Reason(code="VERIFY_MISMATCH", weight=1.0,
                                 **{k: v.format(name=name) for k, v in vt["reason_mismatch"].items()}))  # fmt: skip
    for c in checks:
        if c.check == "public_reports" and c.verdict == "REPORTS_FOUND":
            kind = next(iter(c.input))
            reasons.append(Reason(code="VERIFY_REPORTS", weight=0.2, **{
                k: v.format(kind=vt["kinds"][kind][k]) for k, v in vt["reason_reports"].items()}))  # fmt: skip

    ns = texts["next_steps"]
    steps: list[dict[str, str]] = []
    if mismatch is not None and mismatch.official_contact:
        name = institution or req.claimed_identity_name
        steps.append({k: v.format(name=name, official=mismatch.official_contact)
                      for k, v in ns["mismatch"].items()})  # fmt: skip
    asked = set(req.asked_to)
    if asked & {"otp"}:
        steps.append(dict(ns["otp"]))
    if asked & {"money"}:
        steps.append(dict(ns["money"]))
    if "video_call" in asked and req.claimed_identity_type in {"police", "government"}:
        steps.append(dict(ns["video_call"]))
    if asked & {"secrecy", "go_alone"}:
        steps.append(dict(ns["alone"]))
    if "install_app" in asked:
        steps.append(dict(ns["install_app"]))
    if not steps:
        steps.append(dict(ns["general"]))
    steps.append(dict(ns["report"]))

    if verifier is None:
        vstatus = "unavailable"
    elif not checks:
        vstatus = "timeout"
    elif all(c.status == "unavailable" for c in checks if c.status != "skipped"):
        vstatus = "unavailable"
    else:
        vstatus = "ok"
    return ManualCheckResponse(
        level=level,
        score=score,
        tactics=sorted(result.tactic_strengths),
        top_reasons=reasons[: cfg.max_reasons + 1],
        contributions=[*risk.contributions, *verify_contribs],
        verification_capped=capped,
        institution=institution,
        checks=checks,
        text_analysis=text_analysis,
        next_steps=steps,
        verification_status=vstatus,
    )
