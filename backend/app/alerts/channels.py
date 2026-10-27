"""Alert channels. The dispatcher builds the alert and hands it to every channel that is due.

- `dashboard`: emits an `alert` event on the call's event stream (/ws/events/{id}); the family
  dashboard and /demo show it instantly. Once per call, from HIGH, not per contact.
- `email` (app/alerts/email.py): per contact, from EMAIL_ALERT_MIN_LEVEL, again on escalation.
- SMS / WhatsApp (B9) are per-contact channels: one message per opted-in contact per call.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

from app.events import EventBus, EventType
from app.risk.levels import Level

if TYPE_CHECKING:
    from app.alerts.dispatcher import AlertPayload, Contact


class AlertChannel(Protocol):
    name: str
    per_contact: bool
    # Lowest level this channel fires at.
    min_level: Level
    # Send again when the call reaches a higher level than the one already sent (once per level).
    escalate: bool

    def accepts(self, contact: Contact) -> bool:
        """Per-contact channels only: whether this contact can and may receive this channel."""
        ...

    async def send(self, alert: AlertPayload, contact: Contact | None) -> None: ...


class DashboardChannel:
    name = "dashboard"
    per_contact = False
    min_level = Level.HIGH
    escalate = False

    def __init__(self, bus: EventBus) -> None:
        self._bus = bus

    def accepts(self, contact: Contact) -> bool:
        return True

    async def send(self, alert: AlertPayload, contact: Contact | None) -> None:
        await self._bus.publish(EventType.ALERT, alert)
