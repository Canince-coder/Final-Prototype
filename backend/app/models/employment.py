import uuid
from datetime import datetime, date

from sqlalchemy import JSON, Uuid, ForeignKey, DateTime, Date, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import EmploymentType, VerificationStatus, str_enum


class Employment(Base):
    """A current or past job held by a trainee/employee profile.

    employer_id/job_role_id/job_id link to on-platform records when the job came
    through the platform; company_name/role_title always hold the display values
    so off-platform (past) employment can be recorded too.
    """

    __tablename__ = "employments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trainee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trainees.id", ondelete="CASCADE"), index=True)
    employer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employers.id", ondelete="SET NULL"))
    job_role_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("job_roles.id", ondelete="SET NULL"))
    job_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("jobs.id", ondelete="SET NULL"))
    company_name: Mapped[str] = mapped_column(String(200))
    role_title: Mapped[str] = mapped_column(String(160))
    joining_date: Mapped[date] = mapped_column(Date)  # start date
    end_date: Mapped[date | None] = mapped_column(Date)  # null = current job
    employment_type: Mapped[EmploymentType] = mapped_column(
        str_enum(EmploymentType), default=EmploymentType.FULL_TIME, server_default="FULL_TIME"
    )
    skills_used: Mapped[list[str]] = mapped_column(JSON, default=list)
    salary: Mapped[float | None] = mapped_column(Numeric(12, 2))
    location: Mapped[str] = mapped_column(String(120))
    verification_status: Mapped[VerificationStatus] = mapped_column(
        str_enum(VerificationStatus), default=VerificationStatus.UNVERIFIED, server_default="UNVERIFIED"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trainee: Mapped["Trainee"] = relationship(back_populates="employments")  # noqa: F821
    employer: Mapped["Employer | None"] = relationship()  # noqa: F821
    job_role: Mapped["JobRole | None"] = relationship()  # noqa: F821
    job: Mapped["Job | None"] = relationship()  # noqa: F821

    @property
    def verified(self) -> bool:
        return self.verification_status == VerificationStatus.VERIFIED
