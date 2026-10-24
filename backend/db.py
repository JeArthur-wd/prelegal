"""SQLite database, recreated from scratch every time the app starts."""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

DB_PATH = Path(os.getenv("PRELEGAL_DB_PATH", Path(__file__).parent / "prelegal.db"))

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    template_id TEXT NOT NULL,
    title TEXT NOT NULL,
    field_values TEXT NOT NULL,  -- JSON object of field name -> value
    messages TEXT NOT NULL,      -- JSON array of chat messages
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX documents_by_user ON documents (user_id, updated_at);
"""


def reset_database() -> None:
    """Delete any existing database file and create an empty schema."""
    DB_PATH.unlink(missing_ok=True)
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(DB_PATH)) as conn:
        conn.executescript(SCHEMA)


def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency yielding a connection that is closed after the request."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


def now() -> str:
    """Current UTC time as an ISO 8601 string, precise enough to order rapid saves."""
    return datetime.now(UTC).isoformat(timespec="milliseconds")
