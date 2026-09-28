import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.skill import SkillOut


class EmployerBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_name: str
    location: str


class JobRoleBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None = None


class JobRequirementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    skill_id: uuid.UUID
    required_level: int
    required: bool
    skill: SkillOut


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    location: str
    salary_min: float | None = None
    salary_max: float | None = None
    description: str | None = None
    min_experience_years: float = 0
    min_education_level: int = 0
    created_at: datetime
    employer: EmployerBrief
    job_role: JobRoleBrief
    requirements: list[JobRequirementOut]


class SkillGapOut(BaseModel):
    skill_id: uuid.UUID
    skill_name: str
    required_level: int
    candidate_level: int
    gap: int
    required: bool


class JobMatchOut(BaseModel):
    job_id: uuid.UUID
    job_title: str
    match_percentage: int
    strengths: list[SkillGapOut]
    skill_gaps: list[SkillGapOut]


class JobSkillGapOut(BaseModel):
    job_id: uuid.UUID
    job_title: str
    match_percentage: int
    skill_gaps: list[SkillGapOut]


class RecommendedJobOut(BaseModel):
    job_id: uuid.UUID
    title: str
    company: str
    location: str
    required_skills: list[str]
    matching_skills: list[str]
    missing_skills: list[str]  # not held at all
    skills_to_improve: list[str]  # held, but below the required level
    match_percentage: int
    # original fields, kept for the existing frontend
    job: str
    employer: str
    top_skill_gaps: list[str]


class EmployeeJobOut(RecommendedJobOut):
    eligibility_score: int
    eligible: bool
    experience_required_years: float
    experience_years: float
    experience_met: bool
    education_level_required: int
    education_level: int
    education_met: bool
