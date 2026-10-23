# Stage 1: build the frontend as static files
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# The build reads the template dataset from ../data/templates
COPY data/ /app/data/
RUN npm run build

# Stage 2: Python backend serving the API and the static frontend
FROM python:3.12-slim
RUN pip install --no-cache-dir uv
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev
COPY backend/ ./
COPY --from=frontend /app/frontend/out /app/frontend/out

ENV PRELEGAL_DB_PATH=/app/data/prelegal.db
EXPOSE 8000
CMD [".venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
