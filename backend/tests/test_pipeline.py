"""Audio WebSocket -> VAD -> STT -> utterance events, with a fake STT and a fake VAD classifier."""

import asyncio
import time

import numpy as np
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.audio.buffer import FRAME_BYTES
from app.audio.stt import STTUnavailable, Transcript
from app.events import ComponentStatus
from app.main import create_app

SPEECH = b"\x01" * FRAME_BYTES
SILENCE = b"\x00" * FRAME_BYTES


def is_speech(frame: bytes) -> bool:
    return frame[0] == 1


class FakeSTT:
    """Echoes the utterance length, or misbehaves on request. No canned text."""

    name = "fake"

    def __init__(self, mode: str = "ok", delay: float = 0.0) -> None:
        self.mode = mode
        self.delay = delay
        self.loaded = False

    def status(self):
        return (ComponentStatus.OK, "fake") if self.loaded else (ComponentStatus.UNAVAILABLE, "no")

    async def load(self) -> None:
        self.loaded = self.mode != "unloadable"

    async def transcribe(self, pcm: np.ndarray) -> Transcript:
        if not self.loaded:
            raise STTUnavailable("not loaded")
        if self.mode == "timeout":
            raise TimeoutError
        await asyncio.sleep(self.delay)
        return Transcript(
            text=f"{len(pcm)} samples",
            lang="en",
            detected_language="en",
            lang_probs={"en": 0.9, "hi": 0.1},
            avg_logprob=-0.2,
            no_speech_prob=0.01,
            inference_ms=1.0,
            model="fake",
        )


def make_client(settings, stt):
    settings = settings.model_copy(update={"stt_load_on_startup": True})
    return TestClient(create_app(settings, stt=stt, vad_classifier=is_speech))


def wait_for_stt(client, timeout=2.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status = client.get("/health").json()["components"]["stt"]["status"]
        if status != "loading":
            return status
        time.sleep(0.01)
    raise AssertionError("STT stayed in loading")


def stream_call(client, frames):
    session_id = client.post("/sessions").json()["session_id"]
    with client.websocket_connect(f"/ws/audio/{session_id}") as ws:
        for f in frames:
            ws.send_bytes(f)
    events = []
    with client.websocket_connect(f"/ws/events/{session_id}") as ev:
        client.post(f"/sessions/{session_id}/end")
        try:
            while True:
                events.append(ev.receive_json())
        except WebSocketDisconnect:
            pass
    return [e["payload"] for e in events if e["type"] == "utterance"], events


def test_two_utterances_become_two_transcribed_events(settings):
    frames = [SILENCE] * 10 + [SPEECH] * 50 + [SILENCE] * 40 + [SPEECH] * 25 + [SILENCE] * 40
    with make_client(settings, FakeSTT()) as client:
        wait_for_stt(client)
        utts, events = stream_call(client, frames)
    assert [u["utterance_id"] for u in utts] == ["u1", "u2"]
    assert all(u["stt_status"] == "ok" for u in utts)
    assert utts[0]["t_start_s"] < utts[0]["t_end_s"] < utts[1]["t_start_s"]
    assert utts[0]["text"] == f"{int((utts[0]['t_end_s'] - utts[0]['t_start_s']) * 16000)} samples"
    assert utts[0]["stt_latency_ms"] >= 0
    # The "ended" status arrives after the last utterance (pipeline drained first).
    assert events[-1]["payload"]["status"] == "ended"


def test_trailing_speech_is_flushed_when_audio_socket_closes(settings):
    with make_client(settings, FakeSTT()) as client:
        wait_for_stt(client)
        utts, _ = stream_call(client, [SPEECH] * 40)
    assert len(utts) == 1 and utts[0]["end_reason"] == "flush"


def test_stt_unavailable_is_reported_not_faked(settings):
    with make_client(settings, FakeSTT(mode="unloadable")) as client:
        assert wait_for_stt(client) == "unavailable"
        utts, _ = stream_call(client, [SPEECH] * 40 + [SILENCE] * 40)
    assert utts[0]["stt_status"] == "unavailable"
    assert utts[0]["text"] is None


def test_stt_timeout_marks_component_degraded(settings):
    with make_client(settings, FakeSTT(mode="timeout")) as client:
        wait_for_stt(client)
        utts, events = stream_call(client, [SPEECH] * 40 + [SILENCE] * 40)
        health = client.get("/health").json()
    assert utts[0]["stt_status"] == "timeout" and utts[0]["text"] is None
    assert health["components"]["stt"]["status"] == "degraded"
    assert any(
        e["type"] == "status"
        and e["payload"]["component"] == "stt"
        and e["payload"]["status"] == "degraded"
        for e in events
    )


def test_bad_frame_size_closes_audio_socket(settings):
    with make_client(settings, FakeSTT()) as client:
        session_id = client.post("/sessions").json()["session_id"]
        with client.websocket_connect(f"/ws/audio/{session_id}") as ws:
            ws.send_bytes(b"\x00" * 100)
            with pytest.raises(WebSocketDisconnect) as exc:
                ws.receive_bytes()
        assert exc.value.code == 1003
