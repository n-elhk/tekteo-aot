# Dockerize cv-worker — Design

**Date:** 2026-05-03
**Status:** Approved

## Goal

Eliminate the local Python virtualenv requirement for the `cv-worker` app. All worker development, testing, and linting workflows go through Docker. No Python installation is required on the developer machine.

## Motivation

- `cv-worker` depends on `weasyprint`, which requires several system libraries (Pango, Cairo, GDK-Pixbuf, libffi, fonts) that are painful to install and maintain on a developer machine.
- Every other infrastructure component in the project (postgres, redis, ollama) already runs in Docker.
- A `Dockerfile` and a `cv-worker` service in `docker-compose.yml` already exist but are not wired into the npm scripts.
- The current `worker:install` script (`python3 -m venv .venv && pip install -e '.[dev]'`) creates a local venv that has to be re-created and re-debugged on every developer machine.

## Non-goals

- No change to the `front` and `api` apps' run mode — they continue to run via `nx serve` directly on the host (no Docker).
- No production deployment work. The multi-stage Dockerfile prepares for a future prod image but no deploy pipeline is set up here.
- No CI changes.

## Final state — npm scripts

After this change, `package.json` exposes exactly these dev-related scripts:

| Script | What it runs |
|---|---|
| `npm run dev` | `docker compose up -d postgres redis ollama cv-worker` then `nx run-many -t serve -p front,@org/api --parallel` |
| `npm run dev:no-worker` | `docker compose up -d postgres redis` then `nx run-many -t serve -p front,@org/api --parallel` |
| `npm run dev:worker` | `docker compose up postgres redis ollama cv-worker` (foreground, logs visible) |
| `npm run dev:down` | `docker compose down` |

Unchanged scripts: `prisma:generate`, `prisma:migrate`, `prisma:studio`, `prisma:seed`, `ollama:pull`, `build`, `test`, `lint`, `lint:fix`.

Removed scripts: `dev:front`, `dev:api`, `dev:full`, `services:up`, `services:up:full`, `services:down`, `services:logs`, `db:up`, `db:down`, `db:logs`, `worker:install`.

### Rationale for `dev:down`

`dev` and `dev:no-worker` start Docker services in detached mode (`-d`). When the user hits Ctrl+C, only the foreground processes (front, api via `nx run-many`) stop. The Docker containers stay running. `dev:down` provides an explicit, simple way to stop everything.

### Rationale for `dev:worker` not being detached

When a developer runs only the worker, they typically want to see its live logs (uvicorn reload events, request logs). Running it in the foreground gives that for free. The dependent services (postgres, redis, ollama) start at the same time and are visible in the same log stream.

## `docker-compose.yml` changes

Modify the existing `cv-worker` service:

```yaml
cv-worker:
  build:
    context: ./apps/cv-worker
    dockerfile: Dockerfile
    target: dev          # NEW — selects the dev stage of the multi-stage Dockerfile
  container_name: tekteo-cv-worker
  restart: unless-stopped
  ports:
    - '8000:8000'
  environment:
    LLM_BASE_URL: http://ollama:11434/v1
    LLM_MODEL: ${LLM_MODEL:-mistral:7b-instruct}
    LLM_API_KEY: not-needed
    UPLOADS_ROOT: /data/uploads
    TEMPLATES_ROOT: /data/templates
  volumes:
    - ./apps/cv-worker/src:/app/src         # NEW — hot reload
    - ./apps/api/uploads:/data/uploads
    - ./apps/api/templates:/data/templates:ro
  depends_on:
    - ollama
```

The `dev` stage's CMD already includes `--reload`, so no `command:` override is needed.

Also fix a pre-existing oversight: the `volumes:` block at the bottom of `docker-compose.yml` is missing `redis-data` (currently redis runs without persistence). This is intentional — keep redis ephemeral. No change needed there.

## `apps/cv-worker/Dockerfile` — multi-stage rewrite

```dockerfile
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps for WeasyPrint + curl for healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libcairo2 \
        libgdk-pixbuf-2.0-0 \
        libffi8 \
        shared-mime-info \
        fonts-dejavu-core \
        fonts-liberation \
        fonts-noto \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
ENV PYTHONPATH=/app/src
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD curl -fsS http://localhost:8000/health || exit 1

# ----- Production stage -----
FROM base AS prod
RUN pip install --no-cache-dir -e .
COPY src ./src
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "src"]

# ----- Development stage -----
FROM base AS dev
RUN pip install --no-cache-dir -e ".[dev]"
COPY src ./src
CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "src"]
```

Notes:
- `dev` includes `pytest` and `ruff` so test and lint can run inside the container.
- `dev` enables `--reload` for hot reload (works with the volume mount in `docker-compose.yml`).
- `prod` is unused by this change but exists so a future deploy pipeline can build it (`docker build --target prod`).
- `COPY src ./src` is still present in the `dev` stage as a fallback for when there is no volume mount (e.g., `docker compose run --rm cv-worker pytest` uses the baked-in code).

## `apps/cv-worker/project.json` changes

Replace the `targets` block:

```json
{
  "targets": {
    "serve": {
      "continuous": true,
      "executor": "nx:run-commands",
      "options": {
        "command": "docker compose up cv-worker",
        "cwd": "."
      }
    },
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "command": "docker compose run --rm cv-worker pytest",
        "cwd": "."
      }
    },
    "lint": {
      "executor": "nx:run-commands",
      "options": {
        "command": "docker compose run --rm cv-worker ruff check src tests",
        "cwd": "."
      }
    }
  }
}
```

The `install` target is removed entirely.

This preserves the Nx integration: `nx run cv-worker:serve|test|lint` keeps working, but the underlying execution is Docker, not a local venv.

## Documentation

Update `README.md` at the repo root to reflect:
- New scripts: `dev`, `dev:no-worker`, `dev:worker`, `dev:down`.
- Removal of all `services:*`, `db:*`, `worker:install` scripts.
- Note that Python is no longer required locally for `cv-worker` development.

## Edge cases & decisions

1. **First-time build of cv-worker image**: `docker compose up cv-worker` will trigger an automatic build the first time (because the service uses `build:` not `image:`). No explicit `worker:build` script is needed.
2. **Dependency change in `pyproject.toml`**: requires a manual `docker compose build cv-worker` (or `docker compose up --build cv-worker`). This is acceptable — same friction as `npm install` after a `package.json` change. We can add a `worker:build` script later if it becomes a recurring pain.
3. **Tests need ollama?** Not for unit tests. `docker compose run --rm cv-worker pytest` only spins up the cv-worker container itself, not its `depends_on`. If a test ever needs ollama, the developer can pre-start it with `docker compose up -d ollama`.
4. **Volume mount and `pyproject.toml`**: only `src/` is mounted, not the whole `apps/cv-worker/` directory. So changes to `pyproject.toml` do not leak into a running container — they require a rebuild, which is the desired behavior.
5. **uvicorn `--reload` with volume mount**: uvicorn's reload watcher works on the mounted `/app/src` because Linux propagates inotify events through bind mounts. Confirmed pattern.

## Risks

- **Cold start**: first `npm run dev` after a fresh clone has to build the cv-worker image (~30-60s). Acceptable trade-off for not needing Python.
- **Test latency**: each `nx run cv-worker:test` invocation creates a fresh container (~1-2s overhead). Negligible for a worker with few tests.
- **Hot-reload reliability on WSL2**: file events through bind mounts on WSL2 can occasionally lag. Known limitation; falls back to manually restarting the container if it ever happens.

## Out of scope (explicit)

- CI pipeline changes.
- Production deployment of cv-worker.
- Adding `worker:build` or `worker:logs` shortcuts (use `docker compose build cv-worker` / `docker compose logs -f cv-worker` directly for now).
- Persisting redis data.
