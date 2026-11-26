"""Per-call telemetry. Context variables keep cached providers concurrency-safe."""

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any

_current: ContextVar[dict[str, Any] | None] = ContextVar("ai_execution_usage", default=None)


@contextmanager
def capture_usage():
    collected: dict[str, Any] = {}
    token = _current.set(collected)
    try:
        yield collected
    finally:
        _current.reset(token)


def record_response(response: Any, requested_model: str) -> None:
    target = _current.get()
    if target is None:
        return
    target["requestedModel"] = requested_model
    target["resolvedModel"] = getattr(response, "model", None)
    usage = getattr(response, "usage", None)
    target["usage"] = usage.model_dump() if usage is not None else None
