"""SQLite database, recreated from scratch every time the app starts."""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import closing
from pathlib import Path

DB_PATH = Path(os.getenv("PRELEGAL_DB_PATH", Path(__file__).parent / "prelegal.db"))

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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
    try:
        yield conn
    finally:
        conn.close()
