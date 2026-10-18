"""SQLite persistence for sessions, events and the alert log. Audio is never stored."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import aiosqlite

from app.events import Event

# Payload keys that carry spoken words; removed before writing when STORE_TRANSCRIPTS=false.
TRANSCRIPT_KEYS = frozenset({"text", "span", "spans", "evidence_text"})
REDACTED = "[redacted]"

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL,
    ended_at    TEXT,
    end_reason  TEXT
);
CREATE TABLE IF NOT EXISTS events (
    session_id  TEXT NOT NULL REFERENCES sessions(id),
    seq         INTEGER NOT NULL,
    ts          TEXT NOT NULL,
    type        TEXT NOT NULL,
    payload     TEXT NOT NULL,
    PRIMARY KEY (session_id, seq)
);
CREATE TABLE IF NOT EXISTS alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id),
    ts          TEXT NOT NULL,
    level       TEXT NOT NULL,
    delivered   INTEGER NOT NULL,
    latency_ms  REAL,
    error       TEXT
);
"""


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: (REDACTED if k in TRANSCRIPT_KEYS else redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value


class Storage:
    def __init__(self, path: Path, store_transcripts: bool) -> None:
        self.path = path
        self.store_transcripts = store_transcripts
        self._db: aiosqlite.Connection | None = None

    async def open(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._db = await aiosqlite.connect(self.path)
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA foreign_keys=ON")
        await self._db.executescript(SCHEMA)
        await self._db.commit()

    async def close(self) -> None:
        if self._db is not None:
            await self._db.close()
            self._db = None

    @property
    def available(self) -> bool:
        return self._db is not None

    async def create_session(self, session_id: str, created_at: datetime) -> None:
        if self._db is None:
            return
        await self._db.execute(
            "INSERT INTO sessions (id, created_at) VALUES (?, ?)",
            (session_id, created_at.isoformat()),
        )
        await self._db.commit()

    async def end_session(self, session_id: str, reason: str) -> None:
        if self._db is None:
            return
        await self._db.execute(
            "UPDATE sessions SET ended_at = ?, end_reason = ? WHERE id = ? AND ended_at IS NULL",
            (datetime.now(UTC).isoformat(), reason, session_id),
        )
        await self._db.commit()

    async def save_event(self, event: Event) -> None:
        if self._db is None:
            return
        payload = event.payload if self.store_transcripts else redact(event.payload)
        await self._db.execute(
            "INSERT INTO events (session_id, seq, ts, type, payload) VALUES (?, ?, ?, ?, ?)",
            (
                event.session_id,
                event.seq,
                event.ts.isoformat(),
                event.type.value,
                json.dumps(payload, ensure_ascii=False),
            ),
        )
        await self._db.commit()

    async def events(self, session_id: str) -> list[dict[str, Any]]:
        if self._db is None:
            return []
        cursor = await self._db.execute(
            "SELECT seq, ts, type, payload FROM events WHERE session_id = ? ORDER BY seq",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [
            {"seq": seq, "ts": ts, "type": type_, "payload": json.loads(payload)}
            for seq, ts, type_, payload in rows
        ]
