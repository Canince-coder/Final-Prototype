import uuid
from datetime import datetime

from sqlalchemy import String, Text, Uuid, Integer, Float, ForeignKey, DateTime, UniqueConstraint, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import SkillSource, SkillTrend, VerificationStatus, str_enum


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    # External market signal (0-100) and trend. Populated by seed.py with DEMO values;
    # replace with a real labour-market feed when one is available.
    market_demand: Mapped[int | None] = mapped_column(Integer)
    trend: Mapped[SkillTrend | None] = mapped_column(str_enum(SkillTrend))


class TraineeSkill(Base):
    __tablename__ = "trainee_skills"
    __table_args__ = (
        UniqueConstraint("trainee_id", "skill_id", name="uq_trainee_skill"),
        CheckConstraint("proficiency_level BETWEEN 1 AND 5", name="ck_proficiency_1_5"),
        CheckConstraint("competency_score IS NULL OR competency_score BETWEEN 0 AND 5", name="ck_competency_0_5"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trainee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trainees.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"))
    proficiency_level: Mapped[int] = mapped_column(Integer)
    # Assessed competency (0-5) from project assessment / verified documents; null = not assessed.
    competency_score: Mapped[float | None] = mapped_column(Float)
    verification_status: Mapped[VerificationStatus] = mapped_column(
        str_enum(VerificationStatus), default=VerificationStatus.UNVERIFIED, server_default="UNVERIFIED"
    )
    source: Mapped[SkillSource] = mapped_column(
        str_enum(SkillSource), default=SkillSource.SELF_REPORTED, server_default="SELF_REPORTED"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trainee: Mapped["Trainee"] = relationship(back_populates="skills")  # noqa: F821
    skill: Mapped["Skill"] = relationship()
