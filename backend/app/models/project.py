import uuid
from datetime import datetime

from sqlalchemy import JSON, Float, String, Text, Uuid, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trainee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trainees.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    technologies: Mapped[list[str]] = mapped_column(JSON, default=list)
    repository_url: Mapped[str | None] = mapped_column(String(500))
    overall_score: Mapped[float | None] = mapped_column(Float)
    assessment: Mapped[dict | None] = mapped_column(JSON)  # full assessment payload
    detected_skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
