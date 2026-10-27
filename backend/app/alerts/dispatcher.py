"""Alert dispatcher: each channel fires when the call first reaches its `min_level` (dashboard:
HIGH, once per call; email: EMAIL_ALERT_MIN_LEVEL, again on escalation, at most once per level).

Content is built from fusion output only: level, title, top reasons, the caller's claims
(institution, numbers, UPI IDs, case numbers), the verified official number when verification
provides one, and a "Call <name> now" action. Every channel send has a timeout; the outcome and
latency are logged and stored in the `alerts` table. A failed channel never blocks the others,
and is not retried on every utterance: it gets another chance only when the level rises.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass

from pydantic import BaseModel

from app.alerts.channels import AlertChannel
from app.entities.extract import Entity
from app.risk.fusion import Reason, RiskPayload, load_reasons
from app.risk.levels import Level
from app.storage import Storage

log = logging.getLogger(__name__)

LEVEL_ORDER = [Level.LOW, Level.MEDIUM, Level.HIGH, Level.CRITICAL]


@dataclass(frozen=True)
class Contact:
    id: int
    name: str
    phone_e164: str
    email: str | None = None
    # The user agreed that this contact receives alerts. Per-contact channels never send without it.
    alert_consent: bool = False


class AlertPayload(BaseModel):
    alert_id: str
    utterance_id: str
    level: Level
    score: float
    title: dict[str, str]  # en, hi
    top_reasons: list[Reason]
    claims: list[Entity]
    verified_official_number: str | None
    verification_status: str
    action: dict[str, str]  # en, hi
    contacts: list[str]  # names of opted-in contacts reached by per-contact channels


class CallAlerts:
    """Alert state for one call."""

    def __init__(
        self,
        session_id: str,
        channels: list[AlertChannel],
        storage: Storage,
        elder_name: str,
        send_timeout_s: float,
        recipients: list[Contact] | None = None,
    ) -> None:
        self.session_id = session_id
        self._channels = channels
        self._storage = storage
        self._elder_name = elder_name
        self._timeout = send_timeout_s
        # This call's recipients (the signed-in user's trusted contacts); None = stored contacts.
        self._recipients = recipients
        self._sent: dict[str, Level] = {}  # channel name -> highest level it fired at

    @property
    def fired(self) -> bool:
        return bool(self._sent)

    def _due(self, channel: AlertChannel, level: Level) -> bool:
        rank = LEVEL_ORDER.index
        if rank(level) < rank(channel.min_level):
            return False
        last = self._sent.get(channel.name)
        return last is None or (channel.escalate and rank(level) > rank(last))

    def _build(
        self,
        risk: RiskPayload,
        claims: list[Entity],
        contacts: list[Contact],
        verification_status: str,
    ) -> AlertPayload:
        texts = load_reasons()["alert"]
        if self._elder_name:
            action = {k: v.format(name=self._elder_name) for k, v in texts["action"].items()}
        else:
            action = dict(texts["action_default"])
        return AlertPayload(
            alert_id=uuid.uuid4().hex,
            utterance_id=risk.utterance_id,
            level=risk.level,
            score=risk.score,
            title=dict(texts["title"][risk.level.value]),
            top_reasons=risk.top_reasons,
            claims=claims,
            verified_official_number=None,  # filled by verification (B6) when it confirms one
            verification_status=verification_status,
            action=action,
            contacts=[c.name for c in contacts],
        )

    async def on_risk(
        self, risk: RiskPayload, claims: list[Entity], verification_status: str
    ) -> AlertPayload | None:
        due = [c for c in self._channels if self._due(c, risk.level)]
        if not due:
            return None
        for channel in due:
            self._sent[channel.name] = risk.level
        t0 = time.perf_counter()
        contacts = (
            self._recipients
            if self._recipients is not None
            else await self._storage.active_contacts()
        )
        targets_by_channel: dict[str, list[Contact | None]] = {
            c.name: [k for k in contacts if c.accepts(k)] if c.per_contact else [None] for c in due
        }
        reached = {k.id for ts in targets_by_channel.values() for k in ts if k is not None}
        alert = self._build(
            risk, claims, [k for k in contacts if k.id in reached], verification_status
        )
        delivered, errors = [], []
        for channel in due:
            for contact in targets_by_channel[channel.name]:
                try:
                    await asyncio.wait_for(channel.send(alert, contact), self._timeout)
                    delivered.append(channel.name)
                except Exception as exc:  # includes TimeoutError
                    log.warning("alert channel %s failed: %r", channel.name, exc)
                    errors.append(f"{channel.name}: {exc!r}")
        if not delivered and not errors:
            return None  # only per-contact channels were due, and no contact qualifies
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        log.info(
            "alert %s %s level=%s delivered=%s errors=%d latency=%.1fms",
            self.session_id[:8],
            alert.alert_id[:8],
            alert.level,
            delivered,
            len(errors),
            latency_ms,
        )
        await self._storage.save_alert(
            self.session_id,
            alert.level.value,
            bool(delivered),
            latency_ms,
            "; ".join(errors) or None,
        )
        return alert
