"""Email alerts via Resend: consent, levels (MEDIUM and up, escalation), content, failure isolation.

Resend is never called: a mock httpx transport records the requests.
"""

import asyncio
import json
from datetime import UTC, datetime

import httpx
import pytest

from app.alerts.channels import DashboardChannel
from app.alerts.dispatcher import CallAlerts, Contact
from app.alerts.email import RESEND_URL, EmailChannel, make_email_channel, test_recipients
from app.components import ComponentRegistry
from app.config import Settings
from app.entities.extract import Entity
from app.events import ComponentStatus, EventBus, EventType
from app.risk.fusion import Reason, RiskPayload
from app.risk.levels import Level
from app.storage import Storage

CONSENTING = Contact(1, "Asha", "+919876543210", "asha@example.com", alert_consent=True)
NO_CONSENT = Contact(2, "Ravi", "+919876543211", "ravi@example.com", alert_consent=False)
NO_EMAIL = Contact(3, "Meena", "+919876543212", None, alert_consent=True)
EVIDENCE = "transfer the money to the safe account now"


def risk(level: Level, n: int = 1, score: float | None = None) -> RiskPayload:
    return RiskPayload(
        utterance_id=f"u{n}",
        t_s=float(n),
        score=score
        if score is not None
        else {"LOW": 0.1, "MEDIUM": 0.4, "HIGH": 0.6, "CRITICAL": 0.9}[level.value],
        level=level,
        previous_level=Level.LOW,
        level_changed=True,
        contributions=[],
        top_reasons=[
            Reason(
                code="PAYMENT",
                en="The caller is asking you to send money",
                hi="कॉल करने वाला आपसे पैसे भेजने को कह रहा है",
                evidence_text=EVIDENCE,
                utterance_id=f"u{n}",
                weight=0.45,
            )
        ],
        signals={},
    )


CLAIMS = [Entity(kind="upi", value="fraud@okaxis", raw="fraud at okaxis")]


@pytest.fixture
async def storage(tmp_path):
    s = Storage(tmp_path / "t.db", store_transcripts=True)
    await s.open()
    await s.create_session("s1", datetime.now(UTC))
    yield s
    await s.close()


class Resend:
    """Mock Resend endpoint: records requests, answers with `status` after `delay_s`."""

    def __init__(self, status: int = 200, delay_s: float = 0.0) -> None:
        self.status = status
        self.delay_s = delay_s
        self.requests: list[httpx.Request] = []

    async def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        await asyncio.sleep(self.delay_s)
        return httpx.Response(self.status, json={"id": "email-id"})

    @property
    def bodies(self) -> list[dict]:
        return [json.loads(r.content) for r in self.requests]


def setup(storage, resend, contacts, min_level=Level.MEDIUM, timeout_s=1.0):
    components = ComponentRegistry()
    bus = EventBus("s1", queue_size=64, replay_size=64)
    sub = bus.subscribe()
    email = EmailChannel(
        "re_test",
        "Sentry <alerts@example.com>",
        min_level,
        components,
        timeout_s,
        transport=httpx.MockTransport(resend.handler),
    )
    alerts = CallAlerts(
        "s1", [DashboardChannel(bus), email], storage, "Nani", timeout_s, recipients=contacts
    )
    return alerts, components, sub


def dashboard_alerts(sub) -> list:
    events = []
    while not sub._queue.empty():
        events.append(sub._queue.get_nowait())
    return [e for e in events if e.type == EventType.ALERT]


async def test_medium_emails_only_consenting_contacts_with_email(storage):
    resend = Resend()
    alerts, components, sub = setup(storage, resend, [CONSENTING, NO_CONSENT, NO_EMAIL])

    alert = await alerts.on_risk(risk(Level.MEDIUM), CLAIMS, "unavailable")

    assert alert is not None and alert.contacts == ["Asha"]
    (request,) = resend.requests
    assert str(request.url) == RESEND_URL
    assert request.headers["Authorization"] == "Bearer re_test"
    assert request.headers["Idempotency-Key"]
    (body,) = resend.bodies
    assert body["to"] == ["asha@example.com"]
    assert body["from"] == "Sentry <alerts@example.com>"
    assert dashboard_alerts(sub) == []  # the dashboard still waits for HIGH
    assert components.get("email").status == ComponentStatus.OK


async def test_no_consent_no_email(storage):
    resend = Resend()
    alerts, _, _ = setup(storage, resend, [NO_CONSENT, NO_EMAIL])

    await alerts.on_risk(risk(Level.CRITICAL), CLAIMS, "unavailable")

    assert resend.requests == []


async def test_escalation_emails_once_per_level(storage):
    resend = Resend()
    alerts, _, sub = setup(storage, resend, [CONSENTING])

    for n, level in enumerate(
        [
            Level.LOW,
            Level.MEDIUM,
            Level.MEDIUM,
            Level.HIGH,
            Level.MEDIUM,
            Level.HIGH,
            Level.CRITICAL,
        ]
    ):
        await alerts.on_risk(risk(level, n), CLAIMS, "unavailable")

    assert [b["subject"].split(" / ")[0] for b in resend.bodies] == [
        "Warning signs on a call right now",
        "Possible scam call in progress",
        "Scam call in progress: money or OTP is being demanded",
    ]
    assert len(dashboard_alerts(sub)) == 1  # dashboard: once per call, unchanged


async def test_min_level_setting_is_respected(storage):
    resend = Resend()
    alerts, _, _ = setup(storage, resend, [CONSENTING], min_level=Level.HIGH)

    await alerts.on_risk(risk(Level.MEDIUM), CLAIMS, "unavailable")
    assert resend.requests == []
    await alerts.on_risk(risk(Level.HIGH, 2), CLAIMS, "unavailable")
    assert len(resend.requests) == 1


async def test_email_has_reasons_claims_and_report_but_no_transcript(storage):
    resend = Resend()
    alerts, _, _ = setup(storage, resend, [CONSENTING])

    await alerts.on_risk(risk(Level.HIGH), CLAIMS, "unavailable")

    (body,) = resend.bodies
    for part in (body["text"], body["html"]):
        assert "The caller is asking you to send money" in part
        assert "कॉल करने वाला आपसे पैसे भेजने को कह रहा है" in part
        assert "fraud@okaxis" in part
        assert "Call Nani now" in part
        assert "1930" in part
        assert EVIDENCE not in part
        assert "fraud at okaxis" not in part  # raw transcript form of the claim


@pytest.mark.parametrize(
    "resend", [Resend(status=500), Resend(delay_s=5.0)], ids=["http500", "timeout"]
)
async def test_email_failure_never_blocks_dashboard_or_raises(storage, resend):
    alerts, components, sub = setup(storage, resend, [CONSENTING], timeout_s=0.2)

    alert = await alerts.on_risk(risk(Level.HIGH), CLAIMS, "unavailable")

    assert alert is not None
    assert len(dashboard_alerts(sub)) == 1
    assert components.get("email").status == ComponentStatus.DEGRADED
    (row,) = await storage.alerts("s1")
    assert row["delivered"] is True and "email" in row["error"]


def test_channel_status_from_settings():
    def status(**kw):
        components = ComponentRegistry()
        channel = make_email_channel(Settings(_env_file=None, **kw), components)
        return channel, components.get("email")

    channel, state = status()
    assert channel is None and state.status == ComponentStatus.UNCONFIGURED
    assert "RESEND_API_KEY" in state.detail and "EMAIL_ALERT_FROM" in state.detail

    channel, state = status(
        resend_api_key="re_x", email_alert_from="a@example.com", email_alerts_enabled=False
    )
    assert channel is None and state.status == ComponentStatus.DISABLED

    channel, state = status(resend_api_key="re_x", email_alert_from="a@example.com")
    assert channel is not None and channel.min_level == Level.MEDIUM
    assert state.status == ComponentStatus.OK and "re_x" not in state.detail


def test_test_inbox_override():
    assert test_recipients(Settings(_env_file=None)) is None
    (contact,) = test_recipients(Settings(_env_file=None, email_alert_test_to="me@example.com"))
    assert contact.email == "me@example.com" and contact.alert_consent

    components = ComponentRegistry()
    make_email_channel(
        Settings(
            _env_file=None,
            resend_api_key="re_x",
            email_alert_from="a@example.com",
            email_alert_test_to="me@example.com",
        ),
        components,
    )
    assert "TEST MODE" in components.get("email").detail


@pytest.mark.parametrize(
    ("level", "score", "shown"),
    [(Level.MEDIUM, 0.4372, "0.44"), (Level.HIGH, 0.79, "0.79"), (Level.CRITICAL, 1.0, "1.00")],
)
async def test_email_shows_the_alerts_level_and_score(storage, level, score, shown):
    resend = Resend()
    alerts, _, _ = setup(storage, resend, [CONSENTING])

    await alerts.on_risk(risk(level, score=score), CLAIMS, "unavailable")

    (body,) = resend.bodies
    for part in (body["text"], body["html"]):
        assert f"Risk level: {level.value}" in part
        assert f"Risk Score: {shown} / 1.00" in part
        assert f"जोखिम स्कोर: {shown} / 1.00" in part


async def test_escalation_emails_carry_each_levels_own_score(storage):
    resend = Resend()
    alerts, _, _ = setup(storage, resend, [CONSENTING])

    for n, (level, score) in enumerate(
        [(Level.MEDIUM, 0.45), (Level.HIGH, 0.79), (Level.CRITICAL, 1.0)]
    ):
        await alerts.on_risk(risk(level, n, score=score), CLAIMS, "unavailable")

    assert [
        (f"Risk level: {lv}" in b["text"], f"Risk Score: {sc} / 1.00" in b["text"])
        for b, lv, sc in zip(
            resend.bodies, ["MEDIUM", "HIGH", "CRITICAL"], ["0.45", "0.79", "1.00"], strict=True
        )
    ] == [(True, True)] * 3
