import uuid
from datetime import datetime

from sqlalchemy import String, Text, Integer, Uuid, ForeignKey, DateTime, UniqueConstraint, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import CourseStatus, Difficulty, EnrollmentStatus, str_enum


class TrainingProgram(Base):
    """A training program. Exposed to trainees as "Training Camp" and to admins as "Courses"."""

    __tablename__ = "training_programs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    provider: Mapped[str] = mapped_column(String(200))
    duration: Mapped[str] = mapped_column(String(80))
    difficulty: Mapped[Difficulty] = mapped_column(
        str_enum(Difficulty), default=Difficulty.BEGINNER, server_default="BEGINNER"
    )
    status: Mapped[CourseStatus] = mapped_column(
        str_enum(CourseStatus), default=CourseStatus.ACTIVE, server_default="ACTIVE", index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    skills: Mapped[list["ProgramSkill"]] = relationship(back_populates="program", cascade="all, delete-orphan")


class ProgramSkill(Base):
    __tablename__ = "program_skills"
    __table_args__ = (
        UniqueConstraint("program_id", "skill_id", name="uq_program_skill"),
        CheckConstraint("target_level BETWEEN 1 AND 5", name="ck_target_level_1_5"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_programs.id", ondelete="CASCADE"))
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"))
    target_level: Mapped[int] = mapped_column(Integer)

    program: Mapped["TrainingProgram"] = relationship(back_populates="skills")
    skill: Mapped["Skill"] = relationship()  # noqa: F821


class TrainingEnrollment(Base):
    __tablename__ = "training_enrollments"
    __table_args__ = (UniqueConstraint("trainee_id", "program_id", name="uq_enrollment_trainee_program"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trainee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trainees.id", ondelete="CASCADE"), index=True)
    program_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_programs.id", ondelete="CASCADE"))
    status: Mapped[EnrollmentStatus] = mapped_column(
        str_enum(EnrollmentStatus), default=EnrollmentStatus.ENROLLED, server_default="ENROLLED"
    )
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    program: Mapped["TrainingProgram"] = relationship()
