import os
from typing import Protocol

from openai import OpenAI, OpenAIError
from pydantic import ValidationError

from .errors import PlanningConfigurationError, PlanningProviderError
from .models import GeneratedPlanningResult
from .prompt import SYSTEM_PROMPT


class PlanningProvider(Protocol):
    @property
    def model(self) -> str: ...

    def generate(self, prompt: str) -> GeneratedPlanningResult: ...


class OpenAIPlanningProvider:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        timeout_seconds: float | None = None,
        client: OpenAI | None = None,
    ) -> None:
        resolved_api_key = api_key or os.getenv("OPENAI_API_KEY")
        if client is None and not resolved_api_key:
            raise PlanningConfigurationError(
                "OPENAI_API_KEY is required for /planning/generate."
            )

        self._model = model or os.getenv("OPENAI_MODEL", "gpt-5-mini")
        timeout = timeout_seconds or float(os.getenv("OPENAI_TIMEOUT_SECONDS", "60"))
        self._client = client or OpenAI(api_key=resolved_api_key, timeout=timeout)

    @property
    def model(self) -> str:
        return self._model

    def generate(self, prompt: str) -> GeneratedPlanningResult:
        try:
            response = self._client.responses.parse(
                model=self._model,
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                text_format=GeneratedPlanningResult,
            )
        except (OpenAIError, ValidationError) as error:
            raise PlanningProviderError("OpenAI planning request failed.") from error

        parsed = response.output_parsed
        if parsed is None:
            raise PlanningProviderError(
                "OpenAI returned no structured planning result."
            )

        return parsed
