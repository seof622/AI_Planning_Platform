"""Create an isolated editing fixture in the configured database; no AI calls."""

import json
from datetime import datetime, timezone

from app.config import get_default_openai_model
from app.database import get_session_factory
from app.fixtures import load_mock_planning_result
from app.repository import create_project, list_planning_results, save_planning_result


def main() -> None:
    fixture = load_mock_planning_result()
    # Two independent steps allow a valid reorder as well as a dependency violation.
    fixture["roadmap"][2]["dependsOn"] = [fixture["roadmap"][0]["id"]]
    brief = {
        "planType": "project",
        "context": ["Browser editing E2E fixture"],
        "actionItems": [],
        "successCriterion": "clarity",
    }
    title = f"Editing E2E {datetime.now(timezone.utc).isoformat()}"
    with get_session_factory()() as session:
        project = create_project(session, title=title, description="Browser E2E test data")
        save_planning_result(
            session,
            project=project,
            requirement_content=fixture["requirement"]["content"],
            planning_brief=brief,
            selected_model=get_default_openai_model(),
            result=fixture,
        )
        print(json.dumps({
            "projectId": project.id,
            "resultId": list_planning_results(session, project.id)[0]["id"],
        }))


if __name__ == "__main__":
    main()
