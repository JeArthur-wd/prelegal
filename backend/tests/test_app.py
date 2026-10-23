import sqlite3

from fastapi.testclient import TestClient

from main import create_app
from tests.conftest import signin, signup


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_startup_creates_users_table(client, db_path):
    with sqlite3.connect(db_path) as conn:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master")}
    assert "users" in tables


def test_startup_discards_previous_database(app, db_path):
    db_path.parent.mkdir(parents=True)
    db_path.write_bytes(b"left over from a previous run")

    with TestClient(app) as client:
        assert signup(client).status_code == 201

    with TestClient(app) as client:
        assert signin(client).status_code == 401


def test_serves_frontend_at_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Prelegal" in response.text


def test_unknown_api_route_is_not_swallowed_by_frontend(client):
    assert client.get("/api/does-not-exist").status_code == 404


def test_runs_without_a_frontend_build(db_path, tmp_path):
    with TestClient(create_app(tmp_path / "missing")) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404
