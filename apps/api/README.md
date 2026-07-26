# AI Planning Platform API

FastAPI skeleton for the planning API.

## Local Setup

```bash
cd apps/api
uv sync --extra dev
```

## Run

```bash
uv run uvicorn app.main:app --reload --port 8000
```

The Web app expects this base URL by default:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Docker

From the repository root:

```bash
docker compose up --build api
```

The API image copies the canonical mock fixture from:

```text
packages/shared/src/fixtures/mockPlanningResult.json
```

## Endpoints

- `GET /health`
- `POST /planning/mock`
- `POST /planning/generate`

`/planning/mock` reads the canonical mock fixture from:

```text
packages/shared/src/fixtures/mockPlanningResult.json
```

`/planning/generate` runs the LangGraph workflow in `packages/ai` and uses the
OpenAI Responses API with Pydantic Structured Outputs.

Set these environment variables before calling it:

```text
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-5-mini
OPENAI_ALLOWED_MODELS=gpt-5-mini,gpt-5.6-luna,gpt-5.6-terra,gpt-5.6-sol
OPENAI_TIMEOUT_SECONDS=60
```

`GET /planning/models` returns the configured model catalog for the Web UI.
`OPENAI_MODEL` must be included in `OPENAI_ALLOWED_MODELS`.

## Test

```bash
uv run pytest
```

## PostgreSQL Persistence

The API container runs the Alembic migration automatically before Uvicorn starts.

Project endpoints:

- `POST /projects`
- `GET /projects`
- `GET /projects/{project_id}`
- `POST /projects/{project_id}/planning/generate`
- `GET /projects/{project_id}/planning-results/latest`

Seed one project with the canonical mock planning result:

```bash
docker compose exec api uv run python -m scripts.seed_mock_project
```

Run or roll back migrations manually:

```bash
docker compose exec api uv run alembic upgrade head
docker compose exec api uv run alembic downgrade base
```
