import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import EmploymentStatus


class TraineeUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: EmailStr


class TraineeUpdate(BaseModel):
    """Profile update. `null` / omitted fields are left unchanged.

    Changing `phone` is a sensitive change and requires `current_password`.
    Email and password have their own endpoints under /auth.
    """

    name: str | None = Field(default=None, min_length=1, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, min_length=1, max_length=120)
    education: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=20)
    employment_status: EmploymentStatus | None = None
    current_password: str | None = None


class TraineeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    trainee_uid: str | None = None
    employee_uid: str | None = None
    state: str | None = None
    district: str
    education: str
    phone: str | None = None
    employment_status: EmploymentStatus
    created_at: datetime
    user: TraineeUserOut
