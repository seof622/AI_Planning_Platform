import hashlib
import json
import unicodedata
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .schemas import PlanningBrief


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requirement: str = Field(min_length=1, max_length=8000)
    brief: PlanningBrief
    preference: Literal["balanced", "cost", "quality", "speed"] = "balanced"

    @model_validator(mode="after")
    def validate_and_normalize(self):
        self.requirement = clean_text(self.requirement)
        if not self.requirement:
            raise ValueError("계획 주제를 입력해 주세요.")
        if len(self.brief.context) > 30 or len(self.brief.actionItems) > 40:
            raise ValueError("상황은 30개, 해야 할 일은 40개 이내로 입력해 주세요.")
        self.brief.context = [clean_text(v) for v in self.brief.context if v.strip()]
        self.brief.actionItems = [item.model_copy(update={"title": clean_text(item.title)})
                                 for item in self.brief.actionItems if item.title.strip()]
        self.brief.constraints = clean_text(self.brief.constraints or "") or None
        if any(len(v) > 2000 for v in self.brief.context) or any(
            len(v.title) > 2000 for v in self.brief.actionItems
        ) or len(self.brief.constraints or "") > 8000:
            raise ValueError("입력 항목의 길이를 줄여 주세요.")
        if len(json.dumps(self.model_dump(), ensure_ascii=False)) > 32000:
            raise ValueError("입력 전체는 32,000자 이내로 작성해 주세요.")
        return self


def clean_text(value: str) -> str:
    return unicodedata.normalize("NFC", value.replace("\r\n", "\n").replace("\r", "\n")).strip()


def input_hash(snapshot: dict) -> str:
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode()).hexdigest()


class ReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    input: ReviewInput
    parentReviewId: str | None = Field(default=None, max_length=100)
    idempotencyKey: str = Field(min_length=8, max_length=100)


class ReviewDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["selection", "confirmation"]
    inputHash: str = Field(pattern=r"^[0-9a-f]{64}$")
    selectedModel: str = Field(min_length=1, max_length=100)
    acceptedAssumptions: bool = False
    idempotencyKey: str = Field(min_length=8, max_length=100)


class ConfirmedGeneration(BaseModel):
    model_config = ConfigDict(extra="forbid")
    idempotencyKey: str = Field(min_length=8, max_length=100)


class QualityEvaluationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)
    idempotencyKey: str = Field(min_length=8, max_length=100)
