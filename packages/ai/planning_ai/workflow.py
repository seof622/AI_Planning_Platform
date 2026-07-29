from typing import Any

from langgraph.graph import END, START, StateGraph

from .models import PlanningWorkflowState
from .prompt import build_user_prompt
from .provider import OpenAIPlanningProvider, PlanningProvider
from .validation import normalize_planning_result


class PlanningWorkflow:
    def __init__(self, provider: PlanningProvider | None = None) -> None:
        self._provider = provider or OpenAIPlanningProvider()

        graph = StateGraph(PlanningWorkflowState)
        graph.add_node("prepare_request", self._prepare_request)
        graph.add_node("generate_plan", self._generate_plan)
        graph.add_node("normalize_result", self._normalize_result)
        graph.add_edge(START, "prepare_request")
        graph.add_edge("prepare_request", "generate_plan")
        graph.add_edge("generate_plan", "normalize_result")
        graph.add_edge("normalize_result", END)
        self._graph = graph.compile()

    def generate(self, request: dict[str, Any]) -> dict[str, Any]:
        final_state = self._graph.invoke({"request": request})
        return final_state["result"]

    @staticmethod
    def _prepare_request(state: PlanningWorkflowState) -> dict[str, str]:
        return {"prompt": build_user_prompt(state["request"])}

    def _generate_plan(self, state: PlanningWorkflowState) -> dict[str, Any]:
        return {"generated": self._provider.generate(state["prompt"])}

    def _normalize_result(self, state: PlanningWorkflowState) -> dict[str, Any]:
        options = state["request"].get("options") or {}
        return {
            "result": normalize_planning_result(
                state["generated"],
                model=self._provider.model,
                prompt_version=self._provider.prompt_version,
                include_roadmap=options.get("includeRoadmap") is not False,
            )
        }
