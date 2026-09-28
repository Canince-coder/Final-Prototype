import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import SkillSource, SkillTrend, VerificationStatus


class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None = None


class SkillCatalogOut(SkillOut):
    market_demand: int | None = None
    trend: SkillTrend | None = None


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    market_demand: int | None = Field(default=None, ge=0, le=100)
    trend: SkillTrend | None = None


class TraineeSkillCreate(BaseModel):
    """Add a skill by id (original contract) or by name."""

    skill_id: uuid.UUID | None = None
    skill_name: str | None = Field(default=None, min_length=1, max_length=120)
    proficiency_level: int = Field(ge=1, le=5)

    @model_validator(mode="after")
    def _one_of(self):
        if self.skill_id is None and not self.skill_name:
            raise ValueError("Provide skill_id or skill_name")
        return self


class TraineeSkillUpdate(BaseModel):
    proficiency_level: int = Field(ge=1, le=5)


class ProjectRef(BaseModel):
    id: uuid.UUID
    title: str
    overall_score: float | None = None


class TraineeSkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    skill_id: uuid.UUID
    proficiency_level: int
    competency_score: float | None = None
    verification_status: VerificationStatus
    source: SkillSource
    created_at: datetime
    skill: SkillOut
    projects: list[ProjectRef] = []
