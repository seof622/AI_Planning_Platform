import pytest
from openai import OpenAIError

from planning_ai import OpenAIPlanningProvider, PlanningProviderError


class FailingResponses:
    def parse(self, **_: object) -> None:
        raise OpenAIError("model access denied")


class FailingClient:
    responses = FailingResponses()


def test_openai_provider_preserves_safe_error_detail() -> None:
    provider = OpenAIPlanningProvider(
        client=FailingClient(),  # type: ignore[arg-type]
        model="test-model",
    )

    with pytest.raises(
        PlanningProviderError,
        match="OpenAI planning request failed: model access denied",
    ):
        provider.generate("test prompt")
