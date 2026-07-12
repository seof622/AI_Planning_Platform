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

Both planning endpoints currently read the canonical mock fixture from:

```text
packages/shared/src/fixtures/mockPlanningResult.json
```

## Test

```bash
uv run pytest
```
