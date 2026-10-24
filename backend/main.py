"""Prelegal backend: JSON API under /api, with the static frontend served at /."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

# Load the project-root .env before importing modules that read settings at import time.
load_dotenv(Path(__file__).parent.parent / ".env")

import auth  # noqa: E402
import chat  # noqa: E402
import documents  # noqa: E402
from db import reset_database  # noqa: E402

FRONTEND_DIR = Path(
    os.getenv("PRELEGAL_FRONTEND_DIR", Path(__file__).parent.parent / "frontend" / "out")
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    reset_database()
    yield


def create_app(frontend_dir: Path = FRONTEND_DIR) -> FastAPI:
    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.include_router(auth.router)
    app.include_router(chat.router)
    app.include_router(documents.router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    # Mounted last so the API routes above take precedence.
    if frontend_dir.is_dir():
        app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

    return app


app = create_app()
