from app.database import get_session_factory
from app.fixtures import load_mock_planning_result
from app.repository import create_project, save_planning_result


def main() -> None:
    fixture = load_mock_planning_result()
    project_data = fixture["project"]
    requirement_data = fixture["requirement"]

    with get_session_factory()() as session:
        project = create_project(
            session,
            title=project_data["title"],
            description=project_data["description"],
        )
        save_planning_result(
            session,
            project=project,
            requirement_content=requirement_data["content"],
            planning_brief=None,
            selected_model=fixture.get("metadata", {}).get("model"),
            result=fixture,
        )
        print(f"Seeded mock project: {project.id}")


if __name__ == "__main__":
    main()
