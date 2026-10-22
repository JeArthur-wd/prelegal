"""Tests for the V1 foundation: health check, database setup and chat input validation."""

from sqlalchemy import create_engine, inspect

import database
import routes.chat


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_init_db_creates_tables(monkeypatch):
    engine = create_engine("sqlite://")
    monkeypatch.setattr(database, "engine", engine)

    database.init_db()

    assert set(inspect(engine).get_table_names()) >= {"users", "documents"}


def test_init_db_is_idempotent(monkeypatch):
    engine = create_engine("sqlite://")
    monkeypatch.setattr(database, "engine", engine)

    database.init_db()
    database.init_db()

    assert "users" in inspect(engine).get_table_names()


def test_chat_rejects_empty_messages(client):
    response = client.post("/api/chat/message", json={"messages": []})
    assert response.status_code == 400


def test_chat_reports_ai_failure_as_500(client, monkeypatch):
    def fail(messages):
        raise RuntimeError("provider down")

    monkeypatch.setattr(routes.chat, "process_message", fail)

    response = client.post(
        "/api/chat/message", json={"messages": [{"role": "user", "content": "hi"}]}
    )

    assert response.status_code == 500
    assert "provider down" in response.json()["detail"]
