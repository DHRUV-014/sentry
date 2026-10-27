"""Email alert channel via Resend, exactly as documented at resend.com/docs.

- Send: `POST https://api.resend.com/emails`, `Authorization: Bearer <key>`, JSON
  `{from, to, subject, html, text}`. Success returns `{"id": ...}`.
- `Idempotency-Key` header (unique per request, max 256 chars, kept 24 h), so a retried send
  can't deliver the same alert twice.

Per contact, only to contacts with alert consent and an email address. The email carries the
level, the plain-language reasons, the caller's claims and the "Call <name> now" action, never
transcript words. The dispatcher bounds every send with ALERT_SEND_TIMEOUT_S; a failure raises,
is logged, marks the `email` component degraded and never touches scam detection.
"""

from __future__ import annotations

import html
import logging
from typing import TYPE_CHECKING

import httpx

from app.components import ComponentRegistry
from app.config import Settings
from app.events import ComponentStatus
from app.risk.fusion import load_reasons
from app.risk.levels import Level

if TYPE_CHECKING:
    from app.alerts.dispatcher import AlertPayload, Contact

log = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"
LANGS = ("en", "hi")


class EmailSendError(Exception):
    pass


def render(alert: AlertPayload) -> tuple[str, str, str]:
    """(subject, text, html) in English then Hindi. All wording comes from reasons.yaml."""
    texts = load_reasons()
    email = texts["alert"]["email"]
    footer = [email["footer"], texts["next_steps"]["report"]]
    subject = f"{alert.title['en']} / {alert.title['hi']}"

    def section(lang: str) -> list[tuple[str, list[str]]]:
        out = [
            (
                alert.title[lang],
                [
                    email["level"][lang].format(level=alert.level.value),
                    email["score"][lang].format(score=f"{alert.score:.2f}"),
                ],
            ),
            (
                email["reasons_heading"][lang],
                [r.en if lang == "en" else r.hi for r in alert.top_reasons],
            ),
        ]
        if alert.claims:
            kinds = email["claim_kinds"]
            out.append(
                (
                    email["claims_heading"][lang],
                    [
                        f"{kinds[c.kind][lang] if c.kind in kinds else c.kind}: {c.value}"
                        for c in alert.claims
                    ],
                )
            )
        out.append((alert.action[lang], []))
        return out

    text_parts, html_parts = [], []
    for lang in LANGS:
        for heading, lines in section(lang):
            text_parts.append("\n".join([heading, *(f"- {line}" for line in lines)]))
            items = "".join(f"<li>{html.escape(line)}</li>" for line in lines)
            html_parts.append(
                f"<h3>{html.escape(heading)}</h3>" + (f"<ul>{items}</ul>" if items else "")
            )
        text_parts.append("")
        html_parts.append("<hr>")
    for line in footer:
        text_parts.append(" / ".join(line[lang] for lang in LANGS))
        html_parts.append(
            f"<p><small>{html.escape(' / '.join(line[lang] for lang in LANGS))}</small></p>"
        )
    return subject, "\n\n".join(text_parts), "".join(html_parts)


class EmailChannel:
    name = "email"
    per_contact = True
    escalate = True
    test_to = ""  # EMAIL_ALERT_TEST_TO, shown in the status so test mode is never silent

    def __init__(
        self,
        api_key: str,
        sender: str,
        min_level: Level,
        components: ComponentRegistry,
        timeout_s: float,
        transport: httpx.AsyncBaseTransport | None = None,  # tests inject a mock transport
    ) -> None:
        self._api_key = api_key
        self._sender = sender
        self.min_level = min_level
        self._components = components
        self._timeout = timeout_s
        self._transport = transport

    def accepts(self, contact: Contact) -> bool:
        return contact.alert_consent and bool(contact.email)

    async def send(self, alert: AlertPayload, contact: Contact | None) -> None:
        if contact is None or not self.accepts(contact):
            return  # the dispatcher filters with accepts(); never send without consent
        subject, text, body = render(alert)
        # Reported in `finally`, so a send cancelled by the dispatcher's timeout is reported too.
        failure: str | None = "timed out"
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout, transport=self._transport
            ) as client:
                resp = await client.post(
                    RESEND_URL,
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Idempotency-Key": f"{alert.alert_id}-{contact.id}",
                    },
                    json={
                        "from": self._sender,
                        "to": [contact.email],
                        "subject": subject,
                        "text": text,
                        "html": body,
                    },
                )
            if resp.status_code >= 300:
                failure = f"Resend returned HTTP {resp.status_code}"
                raise EmailSendError(f"Resend HTTP {resp.status_code}: {resp.text[:200]}")
            failure = None
        except httpx.HTTPError as exc:
            failure = f"network error: {exc.__class__.__name__}"
            raise EmailSendError(failure) from exc
        finally:
            if failure is None:
                self._components.set("email", ComponentStatus.OK, self.describe())
            else:
                self._components.set(
                    "email", ComponentStatus.DEGRADED, f"last send failed: {failure}"
                )
        log.info("email alert %s sent (%s)", alert.alert_id[:8], alert.level)

    def describe(self) -> str:
        detail = f"Resend, from {self._sender}, from level {self.min_level.value}"
        if self.test_to:
            detail += f"; TEST MODE: every call emails {self.test_to}"
        return detail


def make_email_channel(settings: Settings, components: ComponentRegistry) -> EmailChannel | None:
    """Build the channel from settings and report its status; None when it can't send."""
    if not settings.email_alerts_enabled:
        components.set("email", ComponentStatus.DISABLED, "EMAIL_ALERTS_ENABLED=false")
        return None
    missing = [
        name
        for name, value in (
            ("RESEND_API_KEY", settings.resend_api_key),
            ("EMAIL_ALERT_FROM", settings.email_alert_from),
        )
        if not value
    ]
    if missing:
        components.set("email", ComponentStatus.UNCONFIGURED, f"{', '.join(missing)} not set")
        return None
    channel = EmailChannel(
        settings.resend_api_key.get_secret_value(),
        settings.email_alert_from,
        Level(settings.email_alert_min_level),
        components,
        settings.alert_send_timeout_s,
    )
    channel.test_to = settings.email_alert_test_to
    components.set("email", ComponentStatus.OK, channel.describe())
    return channel


def test_recipients(settings: Settings) -> list[Contact] | None:
    """EMAIL_ALERT_TEST_TO as the recipient of every call (the developer's own inbox, which
    setting it consents to). None = no override: recipients come from the call itself."""
    from app.alerts.dispatcher import Contact

    if not settings.email_alert_test_to:
        return None
    return [Contact(0, "Test inbox", "", settings.email_alert_test_to, alert_consent=True)]
