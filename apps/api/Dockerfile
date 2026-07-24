FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1
ENV UV_LINK_MODE=copy

WORKDIR /app/apps/api

RUN pip install --no-cache-dir uv

COPY packages/ai /app/packages/ai
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev

COPY apps/api/app ./app
COPY apps/api/scripts ./scripts
COPY apps/api/alembic.ini ./alembic.ini
COPY infra/db /app/infra/db
COPY packages/shared/src/fixtures /app/packages/shared/src/fixtures

EXPOSE 8000

CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
