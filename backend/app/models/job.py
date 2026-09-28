import uuid
from datetime import datetime

from sqlalchemy import String, Text, Integer, Numeric, Uuid, ForeignKey, DateTime, Boolean, UniqueConstraint, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class JobRole(Base):
    __tablename__ = "job_roles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(160), unique=True)
    description: Mapped[str | None] = mapped_column(Text)

    jobs: Mapped[list["Job"]] = relationship(back_populates="job_role")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    employer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"))
    job_role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_roles.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(160))
    location: Mapped[str] = mapped_column(String(120))
    salary_min: Mapped[float | None] = mapped_column(Numeric(12, 2))
    salary_max: Mapped[float | None] = mapped_column(Numeric(12, 2))
    description: Mapped[str | None] = mapped_column(Text)
    min_experience_years: Mapped[float] = mapped_column(Numeric(4, 1), default=0, server_default="0")
    # 0 none, 1 10th, 2 12th/ITI/diploma, 3 graduate, 4 postgraduate, 5 doctorate
    min_education_level: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employer: Mapped["Employer"] = relationship(back_populates="jobs")  # noqa: F821
    job_role: Mapped["JobRole"] = relationship(back_populates="jobs")
    requirements: Mapped[list["JobRequirement"]] = relationship(back_populates="job", cascade="all, delete-orphan")
    applications: Mapped[list["JobApplication"]] = relationship(back_populates="job", cascade="all, delete-orphan")  # noqa: F821


class JobRequirement(Base):
    __tablename__ = "job_requirements"
    __table_args__ = (
        UniqueConstraint("job_id", "skill_id", name="uq_job_skill"),
        CheckConstraint("required_level BETWEEN 1 AND 5", name="ck_required_level_1_5"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"))
    required_level: Mapped[int] = mapped_column(Integer)
    required: Mapped[bool] = mapped_column(Boolean, default=True)

    job: Mapped["Job"] = relationship(back_populates="requirements")
    skill: Mapped["Skill"] = relationship()  # noqa: F821
