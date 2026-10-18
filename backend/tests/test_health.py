from app.components import COMPONENTS


def test_health_reports_every_component(client):
    body = client.get("/health").json()

    assert set(body["components"]) == set(COMPONENTS)
    assert body["components"]["storage"]["status"] == "ok"
    assert body["components"]["llm"]["status"] == "disabled"
    for name in ("voice", "verify", "alerts"):
        assert body["components"][name]["status"] == "unavailable"
    # STT/VAD/lexicon aren't implemented yet, so the core pipeline is degraded, not "ok".
    assert body["status"] == "degraded"
