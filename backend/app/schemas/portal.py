"""Schemas for the modules added in the portal phase: employment history, projects,
resumes, training camp / courses, submissions, announcements, dashboards, admin analytics."""
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, computed_field, model_validator

from app.models.enums import (
    Audience,
    CourseStatus,
    Difficulty,
    DocumentType,
    EmploymentStatus,
    EmploymentType,
    EnrollmentStatus,
    SkillTrend,
    VerificationStatus,
)
from app.schemas.job import EmployeeJobOut, RecommendedJobOut
from app.schemas.skill import SkillOut, TraineeSkillOut

ORM = ConfigDict(from_attributes=True)


# --- employment history ------------------------------------------------------

class EmploymentIn(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    role_title: str = Field(min_length=1, max_length=160)
    location: str = Field(min_length=1, max_length=120)
    start_date: date
    end_date: date | None = None  # null = current job
    employment_type: EmploymentType = EmploymentType.FULL_TIME
    skills_used: list[str] = Field(default_factory=list, max_length=50)
    salary: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _dates(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        if self.start_date > date.today():
            raise ValueError("start_date cannot be in the future")
        return self


class EmploymentOut(BaseModel):
    model_config = ORM

    id: uuid.UUID
    company_name: str
    role_title: str
    location: str
    joining_date: date
    end_date: date | None = None
    employment_type: EmploymentType
    skills_used: list[str]
    salary: float | None = None
    verification_status: VerificationStatus
    verified: bool
    job_id: uuid.UUID | None = None

    @computed_field
    def start_date(self) -> date:
        return self.joining_date

    @computed_field
    def is_current(self) -> bool:
        return self.end_date is None


# --- projects ----------------------------------------------------------------

class ProjectIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=20, max_length=10000)
    technologies: list[str] = Field(default_factory=list, max_length=40)
    repository_url: HttpUrl | None = None


class ProjectAssessmentOut(BaseModel):
    overall_score: float
    technical_complexity: int
    problem_solving: int
    implementation_quality: int
    technology_usage: int
    project_completeness: int
    detected_skills: list[str]
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]
    engine: str
    ai_model: str | None
    disclaimer: str


class ProjectOut(BaseModel):
    model_config = ORM

    id: uuid.UUID
    title: str
    description: str
    technologies: list[str]
    repository_url: str | None = None
    overall_score: float | None = None
    detected_skills: list[str]
    assessment: ProjectAssessmentOut | None = None
    skills_updated: list[str] = []
    created_at: datetime
    assessed_at: datetime | None = None


# --- resume / ATS ------------------------------------------------------------

class ResumeOut(BaseModel):
    model_config = ORM

    id: uuid.UUID
    original_filename: str
    content_type: str
    size_bytes: int
    uploaded_at: datetime
    text_content: str | None = Field(default=None, exclude=True)
    last_analysis: dict | None = None

    @computed_field
    def text_extracted(self) -> bool:
        return bool(self.text_content and self.text_content.strip())


class ResumeAnalyzeIn(BaseModel):
    target_role: str = Field(min_length=2, max_length=160)
    job_description: str = Field(default="", max_length=20000)
    job_id: uuid.UUID | None = None  # use an on-platform job's description + skills


class AtsAnalysisOut(BaseModel):
    ats_score: int
    target_role: str
    matched_skills: list[str]
    missing_skills: list[str]
    missing_keywords: list[str]
    strengths: list[str]
    weaknesses: list[str]
    suggestions: list[str]
    recommended_skills: list[str]
    recommended_projects: list[str]
    score_breakdown: dict[str, int]
    engine: str
    ai_model: str | None
    disclaimer: str


# --- training camp / courses ----------------------------------------------------

class ProgramSkillOut(BaseModel):
    model_config = ORM

    skill_id: uuid.UUID
    target_level: int
    skill: SkillOut


class ProgramOut(BaseModel):
    model_config = ORM

    id: uuid.UUID
    name: str
    description: str | None = None
    provider: str
    duration: str
    difficulty: Difficulty
    status: CourseStatus
    skills: list[ProgramSkillOut]

    @computed_field
    def title(self) -> str:
        return self.name

    @computed_field
    def skills_covered(self) -> list[str]:
        return [ps.skill.name for ps in self.skills]


class EnrollmentOut(BaseModel):
    model_config = ORM

    id: uuid.UUID
    status: EnrollmentStatus
    enrolled_at: datetime
    completed_at: datetime | None = None
    program: ProgramOut
    skills_updated: list[str] = []


class TrainingRecommendation(BaseModel):
    program: ProgramOut
    skills_addressed: list[str]
    relevance_score: int


class TrainingRecommendationsOut(BaseModel):
    target_jobs: list[dict]
    skill_gaps: list[str]
    recommendations: list[TrainingRecommendation]


class CourseSkillIn(BaseModel):
    skill_name: str = Field(min_length=1, max_length=120)
    target_level: int = Field(default=3, ge=1, le=5)


class CourseIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = None
    provider: str = Field(min_length=1, max_length=200)
    duration: str = Field(min_length=1, max_length=80)
    difficulty: Difficulty = Difficulty.BEGINNER
    status: CourseStatus = CourseStatus.ACTIVE
    skills: list[CourseSkillIn] = Field(default_factory=list)


class CourseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = None
    provider: str | None = Field(default=None, min_length=1, max_length=200)
    duration: str | None = Field(default=None, min_length=1, max_length=80)
    difficulty: Difficulty | None = None
    status: CourseStatus | None = None
    skills: list[CourseSkillIn] | None = None  # replaces the skill list when given


# --- submissions -------------------------------------------------------------

class SubmissionOut(BaseModel):
    model_config = ORM

    id: uuid.UUID
    employee_id: uuid.UUID
    employment_id: uuid.UUID | None = None
    file_type: DocumentType
    description: str | None = None
    original_filename: str
    content_type: str
    size_bytes: int
    extracted_skills: list[str]
    uploaded_at: datetime
    verification_status: VerificationStatus
    reviewed_by: uuid.UUID | None = None
    reviewed_at: datetime | None = None
    review_note: str | None = None
    skills_updated: list[str] = []

    @computed_field
    def submission_id(self) -> uuid.UUID:
        return self.id


class SubmissionReviewIn(BaseModel):
    status: VerificationStatus
    note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _final(self):
        if self.status not in (VerificationStatus.VERIFIED, VerificationStatus.REJECTED):
            raise ValueError("status must be VERIFIED or REJECTED")
        return self


# --- announcements -----------------------------------------------------------

class AnnouncementIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=1, max_length=5000)
    target_audience: Audience = Audience.ALL
    expires_at: datetime | None = None
    is_active: bool = True


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    message: str | None = Field(default=None, min_length=1, max_length=5000)
    target_audience: Audience | None = None
    expires_at: datetime | None = None
    is_active: bool | None = None


class AnnouncementOut(BaseModel):
    model_config = ORM

    id: uuid.UUID
    title: str
    message: str
    target_audience: Audience
    is_active: bool
    created_by: uuid.UUID | None = None
    created_at: datetime
    expires_at: datetime | None = None


# --- dashboards --------------------------------------------------------------

class CompetencySummary(BaseModel):
    skills_count: int
    average_proficiency: float  # 1-5, self/derived level
    assessed_skills: int
    average_competency: float | None  # 0-5, from project/document assessment
    verified_skills: int
    projects_assessed: int
    average_project_score: float | None


class TrainingStatusSummary(BaseModel):
    enrolled: int
    completed: int
    dropped: int
    current_programs: list[str]
    completed_programs: list[str]


class TraineeDashboardOut(BaseModel):
    trainee_uid: str | None
    name: str
    email: str
    phone: str | None
    state: str | None
    district: str
    location: str
    education: str
    employment_status: EmploymentStatus
    current_skills: list[TraineeSkillOut]
    competency: CompetencySummary
    training_status: TrainingStatusSummary
    recommended_jobs: list[RecommendedJobOut]
    recommended_training: list[TrainingRecommendation]


class EmployeeDashboardOut(BaseModel):
    employee_id: str | None
    trainee_uid: str | None
    name: str
    email: str
    phone: str | None
    state: str | None
    district: str
    education: str
    employment_status: EmploymentStatus
    skills: list[TraineeSkillOut]
    total_experience_months: int
    total_experience_years: float
    current_employment: list[EmploymentOut]
    past_employment: list[EmploymentOut]
    related_trainee_info: dict
    pending_submissions: int
    top_jobs: list[EmployeeJobOut]


class EmployeeAnalyticsOut(BaseModel):
    employee_uid: str | None
    total_experience_months: int
    total_experience_years: float
    companies_count: int
    past_companies: list[str]
    current_companies: list[str]
    employment_history: list[EmploymentOut]
    skills_gained: list[str]
    employment_timeline: list[dict]


# --- admin analytics -----------------------------------------------------------

class LocationEmploymentOut(BaseModel):
    state: str
    district: str | None = None
    total_trainees: int
    employed_trainees: int
    unemployed_trainees: int
    employment_rate: float
    demo_records: int


class AdminDashboardOut(BaseModel):
    total_trainees: int
    total_employees: int
    employed: int
    unemployed: int
    employment_rate: float
    total_jobs: int
    active_courses: int
    pending_submissions: int
    active_announcements: int
    employment_by_state: list[LocationEmploymentOut]
    demo_data_note: str


class SkillAnalysisOut(BaseModel):
    skill_id: uuid.UUID
    skill: str
    demand_score: int
    market_demand: int | None
    internal_demand: int
    jobs_count: int
    trainees_count: int
    employees_count: int
    availability: int
    skill_gap: int
    trend: SkillTrend | None


class CourseRecommendationOut(BaseModel):
    skill: str
    demand_score: int
    skill_gap: int
    availability: int
    trend: SkillTrend | None
    recommended_course: str
    existing_courses: list[dict]
    action: str


class ProfileListItem(BaseModel):
    model_config = ORM

    id: uuid.UUID
    trainee_uid: str | None
    employee_uid: str | None
    state: str | None
    district: str
    education: str
    employment_status: EmploymentStatus
    is_demo: bool
    name: str
    email: str
    role: str
