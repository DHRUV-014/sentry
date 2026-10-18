"""Registry of pipeline components and their live status (served by /health and status events)."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from app.events import ComponentStatus

COMPONENTS = ("stt", "vad", "lexicon", "llm", "voice", "verify", "alerts", "storage")

# Components whose failure means the core pipeline can't produce a risk score.
CORE_COMPONENTS = ("stt", "vad", "lexicon", "storage")


@dataclass(frozen=True)
class ComponentState:
    status: ComponentStatus
    detail: str
    since: datetime


StatusListener = Callable[[str, ComponentState], None]


class ComponentRegistry:
    def __init__(self) -> None:
        now = datetime.now(UTC)
        self._states = {
            name: ComponentState(ComponentStatus.UNAVAILABLE, "not initialised", now)
            for name in COMPONENTS
        }
        self._listeners: list[StatusListener] = []

    def set(self, name: str, status: ComponentStatus, detail: str = "") -> None:
        if name not in self._states:
            raise KeyError(f"unknown component {name!r}")
        current = self._states[name]
        if current.status == status and current.detail == detail:
            return
        state = ComponentState(status, detail, datetime.now(UTC))
        self._states[name] = state
        for listener in self._listeners:
            listener(name, state)

    def get(self, name: str) -> ComponentState:
        return self._states[name]

    def snapshot(self) -> dict[str, ComponentState]:
        return dict(self._states)

    def add_listener(self, listener: StatusListener) -> None:
        self._listeners.append(listener)

    def overall(self) -> str:
        healthy = (ComponentStatus.OK,)
        return (
            "ok" if all(self._states[c].status in healthy for c in CORE_COMPONENTS) else "degraded"
        )
