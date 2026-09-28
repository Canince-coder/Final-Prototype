import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import ApplicationStatus
from app.schemas.job import EmployerBrief


class ApplicationJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    location: str
    employer: EmployerBrief


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_id: uuid.UUID
    trainee_id: uuid.UUID
    status: ApplicationStatus
    applied_at: datetime
    updated_at: datetime
    job: ApplicationJobOut


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
