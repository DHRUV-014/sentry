"""Per-call sessions: state, event bus, and cleanup when a call ends or goes idle."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.components import ComponentRegistry, ComponentState
from app.config import Settings
from app.events import EventBus, EventType, StatusPayload
from app.storage import Storage

log = logging.getLogger(__name__)


@dataclass
class Session:
    id: str
    created_at: datetime
    bus: EventBus
    last_activity: float = field(default_factory=time.monotonic)
    ended: bool = False

    def touch(self) -> None:
        self.last_activity = time.monotonic()


class SessionManager:
    def __init__(self, settings: Settings, storage: Storage, components: ComponentRegistry):
        self._settings = settings
        self._storage = storage
        self._components = components
        self._sessions: dict[str, Session] = {}
        self._sweeper: asyncio.Task[None] | None = None
        self._pending: set[asyncio.Task[object]] = set()
        components.add_listener(self._on_component_change)

    def __len__(self) -> int:
        return len(self._sessions)

    async def start(self) -> None:
        self._sweeper = asyncio.create_task(self._sweep_idle(), name="session-sweeper")

    async def stop(self) -> None:
        if self._sweeper is not None:
            self._sweeper.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._sweeper
        for session_id in list(self._sessions):
            await self.end(session_id, reason="shutdown")

    async def create(self) -> Session:
        session_id = uuid.uuid4().hex
        created_at = datetime.now(UTC)
        await self._storage.create_session(session_id, created_at)
        bus = EventBus(
            session_id,
            queue_size=self._settings.event_queue_size,
            replay_size=self._settings.event_replay_size,
            sink=self._storage.save_event,
        )
        session = Session(id=session_id, created_at=created_at, bus=bus)
        self._sessions[session_id] = session
        await bus.publish(EventType.STATUS, StatusPayload(component="session", status="started"))
        # Every session starts with the current status of every component.
        for name, state in self._components.snapshot().items():
            await bus.publish(EventType.STATUS, _status_payload(name, state))
        log.info("session %s created", session_id)
        return session

    def get(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    async def end(self, session_id: str, reason: str = "ended") -> bool:
        session = self._sessions.pop(session_id, None)
        if session is None:
            return False
        session.ended = True
        await session.bus.publish(
            EventType.STATUS,
            StatusPayload(component="session", status="ended", detail=reason),
        )
        session.bus.close()
        await self._storage.end_session(session_id, reason)
        log.info("session %s ended (%s)", session_id, reason)
        return True

    def _on_component_change(self, name: str, state: ComponentState) -> None:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        payload = _status_payload(name, state)
        for session in list(self._sessions.values()):
            task = loop.create_task(session.bus.publish(EventType.STATUS, payload))
            self._pending.add(task)
            task.add_done_callback(self._pending.discard)

    async def _sweep_idle(self) -> None:
        timeout = self._settings.session_idle_timeout_s
        interval = min(timeout / 2, 30.0)
        while True:
            await asyncio.sleep(interval)
            now = time.monotonic()
            for session in list(self._sessions.values()):
                if now - session.last_activity > timeout:
                    await self.end(session.id, reason="idle timeout")


def _status_payload(name: str, state: ComponentState) -> StatusPayload:
    return StatusPayload(component=name, status=state.status, detail=state.detail)
