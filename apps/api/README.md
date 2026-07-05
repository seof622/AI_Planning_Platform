# AI Planning Platform API

FastAPI skeleton for the planning API.

## Local setup

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
python -m pip install -e ".[dev]"
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
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
pytest
```
