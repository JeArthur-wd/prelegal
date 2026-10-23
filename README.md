# Prelegal

Draft legal agreements from templates.

## Quick start

Requires [Docker](https://www.docker.com/). Optionally copy `.env.example` to `.env`.

```bash
scripts/start-mac.sh        # or start-linux.sh / start-windows.ps1
```

Open http://localhost:8000. Stop with `scripts/stop-mac.sh` (or the Linux/Windows equivalent).
The database starts empty every time the app starts.

## Development

```bash
# Frontend (http://localhost:3000)
cd frontend && npm install && npm run dev

# Backend (http://localhost:8000, serves frontend/out if it has been built with `npm run build`)
cd backend && uv sync && uv run uvicorn main:app --reload

# Tests
cd backend && uv run pytest
cd frontend && npm test
```
