from copy import deepcopy
import json
from typing import Any

from .config import SHARED_MOCK_FIXTURE_PATH
from .schemas import PlanningRequest


def load_mock_planning_result() -> dict[str, Any]:
    with SHARED_MOCK_FIXTURE_PATH.open(encoding="utf-8") as fixture_file:
        return json.load(fixture_file)


def build_mock_planning_result(request: PlanningRequest) -> dict[str, Any]:
    result = deepcopy(load_mock_planning_result())
    requirement = request.requirement.strip()

    if requirement and result.get("requirement"):
        result["requirement"]["content"] = requirement

    return result
