from functools import lru_cache
import os
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]
SHARED_MOCK_FIXTURE_PATH = (
    ROOT_DIR / "packages" / "shared" / "src" / "fixtures" / "mockPlanningResult.json"
)


@lru_cache
def get_cors_origins() -> list[str]:
    configured_origins = os.getenv("CORS_ORIGINS")

    if configured_origins:
        return [
            origin.strip()
            for origin in configured_origins.split(",")
            if origin.strip()
        ]

    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
