import secrets
import uuid
from datetime import datetime

from sqlalchemy import String, Uuid, ForeignKey, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import EmploymentStatus, str_enum


def new_trainee_uid() -> str:
    return "TRN-" + secrets.token_hex(4).upper()


def new_employee_uid() -> str:
    return "EMP-" + secrets.token_hex(4).upper()


class Trainee(Base):
    """Person profile. Used by TRAINEE users and, since employees are trainees who
    have moved into work, by EMPLOYEE users too (they additionally get employee_uid)."""

    __tablename__ = "trainees"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    trainee_uid: Mapped[str | None] = mapped_column(String(20), unique=True, index=True, default=new_trainee_uid)
    employee_uid: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    state: Mapped[str | None] = mapped_column(String(120), index=True)
    district: Mapped[str] = mapped_column(String(120))
    education: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(20))
    employment_status: Mapped[EmploymentStatus] = mapped_column(
        str_enum(EmploymentStatus), default=EmploymentStatus.UNEMPLOYED, server_default="UNEMPLOYED", index=True
    )
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="trainee")  # noqa: F821
    skills: Mapped[list["TraineeSkill"]] = relationship(back_populates="trainee", cascade="all, delete-orphan")  # noqa: F821
    applications: Mapped[list["JobApplication"]] = relationship(back_populates="trainee", cascade="all, delete-orphan")  # noqa: F821
    employments: Mapped[list["Employment"]] = relationship(back_populates="trainee", cascade="all, delete-orphan")  # noqa: F821
