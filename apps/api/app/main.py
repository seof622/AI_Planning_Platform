from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from planning_ai import (
    PlanningConfigurationError,
    PlanningProviderError,
    PlanningValidationError,
    PlanningWorkflow,
    OpenAIPlanningProvider,
)

from sqlalchemy.orm import Session

from .config import (
    get_allowed_openai_models,
    get_cors_origins,
    get_default_openai_model,
    get_openai_model_catalog,
)
from .database import get_db_session
from .fixtures import build_mock_planning_result
from .repository import (
    create_project,
    get_latest_planning_result,
    get_project,
    list_projects,
    save_planning_result,
    serialize_project,
)
from .schemas import PlanningRequest, ProjectCreate


app = FastAPI(title="AI Planning Platform API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache
def get_planning_workflow(model: str) -> PlanningWorkflow:
    return PlanningWorkflow(provider=OpenAIPlanningProvider(model=model))


def generate_result(request: PlanningRequest) -> dict:
    requested_model = request.options.model if request.options else None
    model = requested_model or get_default_openai_model()
    if model not in get_allowed_openai_models():
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported planning model: {model}.",
        )

    try:
        return get_planning_workflow(model).generate(
            request.model_dump(exclude_none=True)
        )
    except PlanningConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except (PlanningProviderError, PlanningValidationError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/planning/models")
def planning_models() -> dict:
    return get_openai_model_catalog()


@app.post("/planning/mock")
def planning_mock(request: PlanningRequest) -> dict:
    return build_mock_planning_result(request)


@app.post("/planning/generate")
def planning_generate(request: PlanningRequest) -> dict:
    if not request.requirement.strip():
        raise HTTPException(status_code=422, detail="Requirement must not be empty.")

    return generate_result(request)


@app.post("/projects", status_code=201)
def projects_create(
    payload: ProjectCreate,
    session: Session = Depends(get_db_session),
) -> dict:
    if not payload.title.strip():
        raise HTTPException(status_code=422, detail="Project title must not be empty.")
    return serialize_project(
        create_project(
            session,
            title=payload.title,
            description=payload.description,
        )
    )


@app.get("/projects")
def projects_list(session: Session = Depends(get_db_session)) -> list[dict]:
    return [serialize_project(project) for project in list_projects(session)]


@app.get("/projects/{project_id}")
def projects_get(
    project_id: str,
    session: Session = Depends(get_db_session),
) -> dict:
    project = get_project(session, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return serialize_project(project)


@app.post("/projects/{project_id}/planning/generate")
def projects_generate(
    project_id: str,
    request: PlanningRequest,
    session: Session = Depends(get_db_session),
) -> dict:
    if not request.requirement.strip():
        raise HTTPException(status_code=422, detail="Requirement must not be empty.")

    project = get_project(session, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")

    result = generate_result(request)
    return save_planning_result(
        session,
        project=project,
        requirement_content=request.requirement,
        result=result,
    )


@app.get("/projects/{project_id}/planning-results/latest")
def projects_latest_result(
    project_id: str,
    session: Session = Depends(get_db_session),
) -> dict:
    if get_project(session, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found.")

    result = get_latest_planning_result(session, project_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Planning result not found.")
    return result
