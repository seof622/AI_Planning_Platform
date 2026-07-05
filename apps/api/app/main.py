from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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

    result = build_mock_planning_result(request)
    result["metadata"]["model"] = "placeholder"
    result["metadata"]["workflowVersion"] = "api-skeleton-v1"
    return result
