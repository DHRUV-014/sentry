"""FastAPI application: sessions, event stream, and component health."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect

from app.components import ComponentRegistry
from app.config import Settings, get_settings
from app.events import ComponentStatus
from app.session import SessionManager
from app.storage import Storage
from app.verify.verifier import UnavailableVerifier
from app.voice.antispoof import UnavailableAntiSpoof

log = logging.getLogger("scamshield")


def _init_component_status(settings: Settings, components: ComponentRegistry) -> None:
    components.set("stt", ComponentStatus.UNAVAILABLE, "speech-to-text not implemented yet")
    components.set(
        "vad", ComponentStatus.UNAVAILABLE, "voice activity detection not implemented yet"
    )
    components.set("lexicon", ComponentStatus.UNAVAILABLE, "coercion lexicon not implemented yet")
    if settings.llm_enabled:
        components.set("llm", ComponentStatus.UNAVAILABLE, "LLM tagger not implemented yet")
    else:
        components.set("llm", ComponentStatus.DISABLED, "LLM_ENABLED=false")
    components.set("voice", *UnavailableAntiSpoof().status())
    components.set("verify", *UnavailableVerifier().status())
    if settings.telegram_configured:
        components.set(
            "telegram", ComponentStatus.UNAVAILABLE, "Telegram client not implemented yet"
        )
    else:
        components.set("telegram", ComponentStatus.UNCONFIGURED, "TELEGRAM_BOT_TOKEN not set")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        components = ComponentRegistry()
        storage = Storage(settings.resolved_db_path, settings.store_transcripts)
        try:
            await storage.open()
            components.set("storage", ComponentStatus.OK, str(settings.resolved_db_path))
        except Exception as exc:
            log.exception("storage failed to open")
            components.set("storage", ComponentStatus.UNAVAILABLE, f"sqlite open failed: {exc}")
        _init_component_status(settings, components)

        sessions = SessionManager(settings, storage, components)
        await sessions.start()
        app.state.settings = settings
        app.state.components = components
        app.state.storage = storage
        app.state.sessions = sessions
        try:
            yield
        finally:
            await sessions.stop()
            await storage.close()

    app = FastAPI(title="Scam Shield", version="0.1.0", lifespan=lifespan)

    @app.get("/health")
    async def health() -> dict:
        components: ComponentRegistry = app.state.components
        return {
            "status": components.overall(),
            "active_sessions": len(app.state.sessions),
            "components": {
                name: {
                    "status": state.status.value,
                    "detail": state.detail,
                    "since": state.since.isoformat(),
                }
                for name, state in components.snapshot().items()
            },
        }

    @app.post("/sessions", status_code=201)
    async def create_session() -> dict:
        session = await app.state.sessions.create()
        return {"session_id": session.id}

    @app.post("/sessions/{session_id}/end")
    async def end_session(session_id: str) -> dict:
        if not await app.state.sessions.end(session_id, reason="ended by client"):
            raise HTTPException(status_code=404, detail="unknown or already ended session")
        return {"session_id": session_id, "ended": True}

    @app.websocket("/ws/events/{session_id}")
    async def events_ws(websocket: WebSocket, session_id: str) -> None:
        session = app.state.sessions.get(session_id)
        if session is None:
            await websocket.close(code=4404, reason="unknown session")
            return
        await websocket.accept()
        sub = session.bus.subscribe(replay=True)
        try:
            async for event in sub:
                await websocket.send_text(event.model_dump_json())
            await websocket.close(code=1000, reason="session ended")
        except WebSocketDisconnect:
            pass
        finally:
            sub.close()

    return app


app = create_app()
