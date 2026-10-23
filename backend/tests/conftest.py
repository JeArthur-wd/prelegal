import pytest
from fastapi.testclient import TestClient

import db
from main import create_app

PASSWORD = "correct-horse"


@pytest.fixture
def frontend_dir(tmp_path):
    out = tmp_path / "out"
    out.mkdir()
    (out / "index.html").write_text("<html>Prelegal</html>")
    return out


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "data" / "test.db"
    monkeypatch.setattr(db, "DB_PATH", path)
    return path


@pytest.fixture
def app(db_path, frontend_dir):
    return create_app(frontend_dir)


@pytest.fixture
def client(app):
    """Client with the app started, so the database has just been created."""
    with TestClient(app) as client:
        yield client


def signup(client, email="user@example.com", password=PASSWORD):
    return client.post("/api/auth/signup", json={"email": email, "password": password})


def signin(client, email="user@example.com", password=PASSWORD):
    return client.post("/api/auth/signin", json={"email": email, "password": password})
