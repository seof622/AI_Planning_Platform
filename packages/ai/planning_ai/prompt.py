import json
from typing import Any


PROMPT_VERSION = "planning-prompt-v1"

SYSTEM_PROMPT = """
You are the planning engine for a visual planning application.
Convert the user's request into a concise component graph and an executable roadmap.

Requirements:
- Write user-facing labels, descriptions, and the summary in the user's language.
- Return 4 to 10 distinct nodes with unique kebab-case ids prefixed with "node-".
- Return only meaningful directed edges. Every source and target must reference a node id.
- Do not create self-referencing edges.
- Return roadmap ids prefixed with "step-" and unique positive order values.
- Every roadmap dependency must reference another roadmap id.
- Every componentNodeIds entry must reference a node id.
- Keep the graph acyclic when practical.
- Respect preferredNodeTypes when supplied, while adding other necessary types.
- Return an empty roadmap only when includeRoadmap is explicitly false.
- Do not include markdown or commentary outside the structured result.
""".strip()


def build_user_prompt(request: dict[str, Any]) -> str:
    return (
        "Create a planning graph from this validated request:\n"
        + json.dumps(request, ensure_ascii=False, indent=2)
    )
