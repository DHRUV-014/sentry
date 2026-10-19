"""Trained tactic classifier behind CoercionEngine: hits, statuses, caps, degradation."""

import asyncio
import statistics
import time

import pytest
from fastapi.testclient import TestClient

from app.coercion.engine import CoercionEngine
from app.coercion.model_tagger import MODEL_DIR, REQUIRED_FILES, ModelTagger, TacticModel
from app.main import create_app
from app.risk.levels import Level

TACTICS = ["AUTHORITY", "THREAT", "URGENCY", "SECRECY", "ISOLATION", "PAYMENT", "CREDENTIAL"]


class FakeModel:
    """Stands in for TacticModel: fixed probabilities per call."""

    def __init__(self, probs: dict[str, float], threshold: float = 0.5) -> None:
        self.labels = TACTICS
        self.thresholds = dict.fromkeys(TACTICS, threshold)
        self.run = "fake"
        self._probs = probs

    def probs(self, text, normalized=None):
        return [self._probs.get(t, 0.0) for t in TACTICS]


class SlowTagger:
    async def tag(self, text, normalized):
        await asyncio.sleep(5)
        return []


class BrokenTagger:
    async def tag(self, text, normalized):
        raise RuntimeError("boom")


def test_hits_above_threshold_only():
    tagger = ModelTagger(FakeModel({"THREAT": 0.9, "PAYMENT": 0.4}), weight=0.8)
    (hit,) = tagger.hits("aapke khilaf warrant hai")
    assert hit.category == "THREAT" and hit.source == "model"
    assert hit.score == pytest.approx(0.8 * 0.9)
    assert hit.span == "aapke khilaf warrant hai"


async def test_engine_reports_model_hits_and_source_contributions():
    engine = CoercionEngine.load(model=ModelTagger(FakeModel({"SECRECY": 0.95}), weight=0.8))
    # Indirect secrecy the lexicon has no pattern for; the model hit carries it.
    r = await engine.new_call().process("u1", 0.0, "this stays between the two of us, okay ji")
    assert r.model_status == "ok"
    assert any(h.tactic == "SECRECY" and h.source == "model" for h in r.hits)
    signals = {c.signal: c for c in r.contributions}
    assert "coercion.SECRECY.model" in signals
    assert signals["coercion.SECRECY.model"].evidence_utterance_id == "u1"


async def test_model_hits_respect_single_utterance_cap():
    engine = CoercionEngine.load(
        model=ModelTagger(FakeModel(dict.fromkeys(TACTICS, 1.0)), weight=1.0)
    )
    r = await engine.new_call().process("u1", 0.0, "anything at all")
    assert r.level == Level.MEDIUM and "single_tactic_or_utterance" in r.caps_applied


@pytest.mark.parametrize(
    ("tagger", "status"), [(SlowTagger(), "timeout"), (BrokenTagger(), "error")]
)
async def test_model_failure_degrades_to_lexicon(tagger, status):
    engine = CoercionEngine.load(model=tagger, model_timeout_s=0.05)
    r = await engine.new_call().process("u1", 0.0, "There is an arrest warrant against you.")
    assert r.model_status == status
    assert any(h.tactic == "THREAT" and h.source == "lexicon" for h in r.hits)


async def test_no_model_is_reported_disabled():
    r = await CoercionEngine.load().new_call().process("u1", 0.0, "hello")
    assert r.model_status == "disabled"


def test_health_reports_missing_model_as_unavailable(settings, tmp_path):
    settings.coercion_model_enabled = True
    settings.coercion_model_dir = tmp_path / "no-model"
    with TestClient(create_app(settings)) as c:
        comp = c.get("/health").json()["components"]["classifier"]
    assert comp["status"] == "unavailable"
    assert "make train-coercion" in comp["detail"]


def test_health_reports_disabled(client):
    assert client.get("/health").json()["components"]["classifier"]["status"] == "disabled"


real_model = pytest.mark.skipif(
    not all((MODEL_DIR / f).exists() for f in REQUIRED_FILES),
    reason="no trained model in models/coercion (run `make train-coercion`)",
)


@real_model
def test_real_model_latency_under_budget():
    model = TacticModel.load(MODEL_DIR, threads=1)
    texts = [
        "Sir, I am calling from the cyber crime branch, your Aadhaar is linked to a money laundering case.",
        "आप किसी को कुछ मत बताइए, यह गोपनीय जांच है।",
        "Beta aaj shaam ko khana kya bana rahe ho, main aa rahi hoon.",
    ] * 20
    model.probs(texts[0])
    lat = []
    for t in texts:
        t0 = time.perf_counter()
        model.probs(t)
        lat.append((time.perf_counter() - t0) * 1000)
    assert statistics.median(lat) < 150 and max(lat) < 300, lat
