import uuid
 
from pydantic import BaseModel
 
from app.models.enums import ApplicationStatus
 
 
class PlatformOverviewOut(BaseModel):
    total_trainees: int
    total_employers: int
    total_jobs: int
    total_skills: int
    total_applications: int
    total_employments: int
    employed_trainees: int
    employment_rate: float
 
 
class ApplicationsByStatusOut(BaseModel):
    counts: dict[ApplicationStatus, int]
 
 
class SkillDemandSupplyOut(BaseModel):
    skill_id: uuid.UUID
    skill_name: str
    demand_count: int
    supply_count: int
    gap: int
 
 
class EmployerAnalyticsOut(BaseModel):
    total_jobs: int
    total_applications: int
    applications_by_status: dict[ApplicationStatus, int]
    total_employments: int