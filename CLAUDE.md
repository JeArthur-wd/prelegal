# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on the templates in `data/templates/`.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents, and the fields each one needs, are defined in `data/templates/catalog.json`
(see `data/templates/README.md` for the format). Run `python scripts/validate_templates.py` after changing templates.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR to `JeArthur-wd/prelegal` using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

The OPENROUTER_API_KEY goes in the `.env` file in the project root (see `.env.example`).

## Technical design

- The entire project is packaged into a Docker container (`Dockerfile`, `docker-compose.yml`).
- The backend is in `backend/`: a uv project using FastAPI. Run tests with `cd backend && uv run pytest`.
- The frontend is in `frontend/`: Next.js, built as a static export (`output: "export"`) and served by FastAPI.
  Static export rules out server-only Next.js features such as Cache Components. Read the docs in
  `frontend/node_modules/next/dist/docs/` before writing Next.js code (see `frontend/AGENTS.md`).
  Run tests with `cd frontend && npm test`.
- The database is SQLite and is created from scratch each time the app starts, with a users table for sign up and sign in.
- Scripts to start and stop the app, which is then available at http://localhost:8000:

```bash
scripts/start-mac.sh        scripts/stop-mac.sh        # Mac
scripts/start-linux.sh      scripts/stop-linux.sh      # Linux
scripts/start-windows.ps1   scripts/stop-windows.ps1   # Windows
```

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation Status

- PL-2: Legal template dataset in `data/templates/`
- PL-3: Mutual NDA creator prototype (form + live preview + download)
- PL-4: V1 foundation: Docker, FastAPI backend serving the static frontend, fresh SQLite DB per start,
  start/stop scripts. API: `GET /api/health`, `POST /api/auth/signup`, `POST /api/auth/signin`
  (no sessions yet).
