from functools import lru_cache
import os
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]
SHARED_MOCK_FIXTURE_PATH = (
    ROOT_DIR / "packages" / "shared" / "src" / "fixtures" / "mockPlanningResult.json"
)

DEFAULT_OPENAI_MODEL = "gpt-5-mini"
DEFAULT_ALLOWED_OPENAI_MODELS = (
    "gpt-5-mini",
    "gpt-5.6-luna",
    "gpt-5.6-terra",
    "gpt-5.6-sol",
)
OPENAI_MODEL_LABELS = {
    "gpt-5-mini": "GPT-5 mini",
    "gpt-5.6-luna": "GPT-5.6 Luna",
    "gpt-5.6-terra": "GPT-5.6 Terra",
    "gpt-5.6-sol": "GPT-5.6 Sol",
}
DEFAULT_MODEL_GUIDANCE = {
    "description": "범용 계획 생성에 사용할 수 있는 모델입니다.",
    "quality": "high",
    "speed": "balanced",
    "cost": "medium",
    "recommendedFor": "일반적인 계획 초안과 구조화 작업",
}
OPENAI_MODEL_GUIDANCE = {
    "gpt-5-mini": {
        "description": "빠르고 경제적으로 계획 초안을 생성합니다.",
        "quality": "standard",
        "speed": "fast",
        "cost": "low",
        "recommendedFor": "빠른 초안, 반복 탐색, 간단한 계획",
    },
    "gpt-5.6-luna": {
        "description": "속도와 결과 품질의 균형을 맞춘 모델입니다.",
        "quality": "high",
        "speed": "fast",
        "cost": "medium",
        "recommendedFor": "일반 프로젝트, 학습 및 일상 계획",
    },
    "gpt-5.6-terra": {
        "description": "복잡한 요구사항을 더 깊이 분석하는 모델입니다.",
        "quality": "high",
        "speed": "balanced",
        "cost": "medium",
        "recommendedFor": "복잡한 프로젝트와 의사결정 계획",
    },
    "gpt-5.6-sol": {
        "description": "완성도와 세밀한 추론을 우선하는 모델입니다.",
        "quality": "highest",
        "speed": "deliberate",
        "cost": "high",
        "recommendedFor": "중요한 설계, 고난도 계획, 최종안 작성",
    },
}


@lru_cache
def get_cors_origins() -> list[str]:
    configured_origins = os.getenv("CORS_ORIGINS")

    if configured_origins:
        return [
            origin.strip()
            for origin in configured_origins.split(",")
            if origin.strip()
        ]

    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


@lru_cache
def get_allowed_openai_models() -> tuple[str, ...]:
    configured_models = os.getenv("OPENAI_ALLOWED_MODELS")
    values = (
        configured_models.split(",")
        if configured_models
        else DEFAULT_ALLOWED_OPENAI_MODELS
    )
    models = tuple(dict.fromkeys(value.strip() for value in values if value.strip()))
    if not models:
        raise RuntimeError("OPENAI_ALLOWED_MODELS must contain at least one model.")
    return models


@lru_cache
def get_default_openai_model() -> str:
    model = os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL).strip()
    if model not in get_allowed_openai_models():
        raise RuntimeError(
            "OPENAI_MODEL must be included in OPENAI_ALLOWED_MODELS."
        )
    return model


def get_openai_model_catalog() -> dict:
    default_model = get_default_openai_model()
    return {
        "defaultModel": default_model,
        "models": [
            {
                "id": model,
                "label": OPENAI_MODEL_LABELS.get(model, model),
                **OPENAI_MODEL_GUIDANCE.get(model, DEFAULT_MODEL_GUIDANCE),
            }
            for model in get_allowed_openai_models()
        ],
    }
