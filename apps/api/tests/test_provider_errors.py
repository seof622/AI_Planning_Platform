import pytest
from openai import OpenAIError

from planning_ai import (
    OpenAIPlanningProvider,
    PlanningConfigurationError,
    PlanningProviderError,
)


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


def test_openai_provider_selects_prompt_version() -> None:
    provider = OpenAIPlanningProvider(
        client=FailingClient(),  # type: ignore[arg-type]
        model="test-model",
        prompt_version="planning-prompt-v1",
    )

    assert provider.prompt_version == "planning-prompt-v1"


def test_openai_provider_rejects_unknown_prompt_version() -> None:
    with pytest.raises(
        PlanningConfigurationError,
        match="Unsupported planning prompt version",
    ):
        OpenAIPlanningProvider(
            client=FailingClient(),  # type: ignore[arg-type]
            model="test-model",
            prompt_version="planning-prompt-unknown",
        )
