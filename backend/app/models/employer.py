import uuid

from sqlalchemy import String, Uuid, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Employer(Base):
    __tablename__ = "employers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    company_name: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(120))

    user: Mapped["User"] = relationship(back_populates="employer")  # noqa: F821
    jobs: Mapped[list["Job"]] = relationship(back_populates="employer", cascade="all, delete-orphan")  # noqa: F821
