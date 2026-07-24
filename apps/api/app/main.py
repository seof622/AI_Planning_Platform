from functools import lru_cache

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from planning_ai import (
    PlanningConfigurationError,
    PlanningProviderError,
    PlanningValidationError,
    PlanningWorkflow,
)

from .config import get_cors_origins
from .fixtures import build_mock_planning_result
from .schemas import PlanningRequest


app = FastAPI(title="AI Planning Platform API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache
def get_planning_workflow() -> PlanningWorkflow:
    return PlanningWorkflow()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/planning/mock")
def planning_mock(request: PlanningRequest) -> dict:
    return build_mock_planning_result(request)


@app.post("/planning/generate")
def planning_generate(request: PlanningRequest) -> dict:
    if not request.requirement.strip():
        raise HTTPException(status_code=422, detail="Requirement must not be empty.")

    try:
        return get_planning_workflow().generate(request.model_dump(exclude_none=True))
    except PlanningConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except (PlanningProviderError, PlanningValidationError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
