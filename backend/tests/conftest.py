"""Shared pytest fixtures: an isolated in-memory database and API clients."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app

PASSWORD = "secret123"


@pytest.fixture
def engine():
    """Fresh in-memory SQLite engine per test, shared across connections."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture
def client(engine):
    """API client backed by the test database (lifespan is not run, so no prelegal.db is created)."""
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def signup(client: TestClient, email: str = "user@example.com", password: str = PASSWORD):
    """Sign up a user; the client keeps the auth cookie."""
    return client.post("/api/auth/signup", json={"email": email, "password": password})


@pytest.fixture
def auth_client(client):
    """API client signed in as user@example.com."""
    assert signup(client).status_code == 200
    return client
