import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_trainee
from app.db.session import get_db
from app.models.enums import CourseStatus, EnrollmentStatus, SkillSource
from app.models.project import Project
from app.models.trainee import Trainee
from app.models.training import ProgramSkill, TrainingEnrollment, TrainingProgram
from app.routers.auth import require_current_password
from app.routers.profile import skills_out
from app.schemas.job import RecommendedJobOut
from app.schemas.portal import (
    CompetencySummary,
    EnrollmentOut,
    TraineeDashboardOut,
    TrainingRecommendationsOut,
    TrainingStatusSummary,
)
from app.schemas.trainee import TraineeOut, TraineeUpdate
from app.services.matching import recommend_jobs, recommend_training
from app.services.skills import apply_detected_skills

router = APIRouter(prefix="/trainees", tags=["trainees"])

_ENROLLMENT_LOAD = selectinload(TrainingEnrollment.program).selectinload(TrainingProgram.skills).selectinload(ProgramSkill.skill)


def _avg(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 2) if values else None


@router.get("/me", response_model=TraineeOut)
def read_my_profile(trainee: Trainee = Depends(get_current_trainee)):
    return trainee


@router.put("/me", response_model=TraineeOut)
def update_my_profile(
    payload: TraineeUpdate,
    trainee: Trainee = Depends(get_current_trainee),
    db: Session = Depends(get_db),
):
    changes = payload.model_dump(exclude_none=True, exclude={"current_password"})
    if "phone" in changes and changes["phone"] != (trainee.phone or ""):
        # sensitive field: require re-authentication
        if not payload.current_password:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Changing phone requires current_password",
            )
        require_current_password(trainee.user, payload.current_password)
    if "name" in changes:
        trainee.user.name = changes.pop("name")
    if "phone" in changes:
        changes["phone"] = changes["phone"] or None  # "" clears the phone
    for field, value in changes.items():
        setattr(trainee, field, value)
    db.commit()
    db.refresh(trainee)
    return trainee


@router.get("/me/dashboard", response_model=TraineeDashboardOut)
def trainee_dashboard(trainee: Trainee = Depends(get_current_trainee), db: Session = Depends(get_db)):
    skills = skills_out(db, trainee)
    projects = db.scalars(
        select(Project).where(Project.trainee_id == trainee.id, Project.overall_score.is_not(None))
    ).all()
    enrollments = db.scalars(
        select(TrainingEnrollment).where(TrainingEnrollment.trainee_id == trainee.id).options(_ENROLLMENT_LOAD)
    ).all()
    by_status = {s: [e.program.name for e in enrollments if e.status == s] for s in EnrollmentStatus}
    assessed = [s.competency_score for s in skills if s.competency_score is not None]
    return TraineeDashboardOut(
        trainee_uid=trainee.trainee_uid,
        name=trainee.user.name,
        email=trainee.user.email,
        phone=trainee.phone,
        state=trainee.state,
        district=trainee.district,
        location=", ".join(p for p in (trainee.district, trainee.state) if p),
        education=trainee.education,
        employment_status=trainee.employment_status,
        current_skills=skills,
        competency=CompetencySummary(
            skills_count=len(skills),
            average_proficiency=_avg([s.proficiency_level for s in skills]) or 0.0,
            assessed_skills=len(assessed),
            average_competency=_avg(assessed),
            verified_skills=sum(s.verification_status == "VERIFIED" for s in skills),
            projects_assessed=len(projects),
            average_project_score=_avg([p.overall_score for p in projects]),
        ),
        training_status=TrainingStatusSummary(
            enrolled=len(by_status[EnrollmentStatus.ENROLLED]),
            completed=len(by_status[EnrollmentStatus.COMPLETED]),
            dropped=len(by_status[EnrollmentStatus.DROPPED]),
            current_programs=by_status[EnrollmentStatus.ENROLLED],
            completed_programs=by_status[EnrollmentStatus.COMPLETED],
        ),
        recommended_jobs=recommend_jobs(db, trainee.id, limit=5),
        recommended_training=recommend_training(db, trainee.id, limit=5)["recommendations"],
    )


@router.get("/me/recommended-jobs", response_model=list[RecommendedJobOut])
def recommended_jobs(
    limit: int = Query(10, ge=1, le=50),
    trainee: Trainee = Depends(get_current_trainee),
    db: Session = Depends(get_db),
):
    """Rule-based: trainee skills vs job requirements -> matching/missing skills and match %."""
    return recommend_jobs(db, trainee.id, limit)


# --- Training Camp ---------------------------------------------------------

@router.get("/me/training", response_model=list[EnrollmentOut])
def my_training_history(
    status_filter: EnrollmentStatus | None = Query(None, alias="status"),
    trainee: Trainee = Depends(get_current_trainee),
    db: Session = Depends(get_db),
):
    stmt = select(TrainingEnrollment).where(TrainingEnrollment.trainee_id == trainee.id)
    if status_filter:
        stmt = stmt.where(TrainingEnrollment.status == status_filter)
    return db.scalars(stmt.options(_ENROLLMENT_LOAD).order_by(TrainingEnrollment.enrolled_at.desc())).all()


@router.get("/me/recommended-training", response_model=TrainingRecommendationsOut)
def recommended_training(
    target_job_id: uuid.UUID | None = None,
    limit: int = Query(10, ge=1, le=50),
    trainee: Trainee = Depends(get_current_trainee),
    db: Session = Depends(get_db),
):
    """Current skills + skill gaps + target job requirements -> ranked programs.
    Without target_job_id, the 3 best-matching jobs that still have gaps are used."""
    return recommend_training(db, trainee.id, target_job_id, limit)


def _reload_enrollment(db: Session, enrollment_id: uuid.UUID) -> TrainingEnrollment:
    return db.scalar(select(TrainingEnrollment).where(TrainingEnrollment.id == enrollment_id).options(_ENROLLMENT_LOAD))


@router.post("/me/training/{program_id}/enroll", response_model=EnrollmentOut, status_code=status.HTTP_201_CREATED)
def enroll(program_id: uuid.UUID, trainee: Trainee = Depends(get_current_trainee), db: Session = Depends(get_db)):
    program = db.get(TrainingProgram, program_id)
    if program is None or program.status != CourseStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training program not found or inactive")
    existing = db.scalar(
        select(TrainingEnrollment).where(
            TrainingEnrollment.trainee_id == trainee.id, TrainingEnrollment.program_id == program_id
        )
    )
    if existing is not None:
        if existing.status != EnrollmentStatus.DROPPED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already enrolled in this program")
        existing.status, existing.enrolled_at, existing.completed_at = EnrollmentStatus.ENROLLED, datetime.now(timezone.utc), None
        enrollment = existing
    else:
        enrollment = TrainingEnrollment(trainee_id=trainee.id, program_id=program_id)
        db.add(enrollment)
    db.commit()
    return _reload_enrollment(db, enrollment.id)


def _own_enrollment(db: Session, trainee: Trainee, enrollment_id: uuid.UUID) -> TrainingEnrollment:
    enrollment = _reload_enrollment(db, enrollment_id)
    if enrollment is None or enrollment.trainee_id != trainee.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    if enrollment.status != EnrollmentStatus.ENROLLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Enrollment is already {enrollment.status.value}"
        )
    return enrollment


@router.post("/me/training/enrollments/{enrollment_id}/complete", response_model=EnrollmentOut)
def complete_training(
    enrollment_id: uuid.UUID, trainee: Trainee = Depends(get_current_trainee), db: Session = Depends(get_db)
):
    """Mark a program completed; its skills are added/raised on the profile (source TRAINING, unverified)."""
    enrollment = _own_enrollment(db, trainee, enrollment_id)
    enrollment.status = EnrollmentStatus.COMPLETED
    enrollment.completed_at = datetime.now(timezone.utc)
    touched = []
    for ps in enrollment.program.skills:
        touched += apply_detected_skills(db, trainee, [ps.skill.name], source=SkillSource.TRAINING, level=ps.target_level)
    db.commit()
    result = _reload_enrollment(db, enrollment.id)
    result.skills_updated = touched
    return result


@router.post("/me/training/enrollments/{enrollment_id}/drop", response_model=EnrollmentOut)
def drop_training(
    enrollment_id: uuid.UUID, trainee: Trainee = Depends(get_current_trainee), db: Session = Depends(get_db)
):
    enrollment = _own_enrollment(db, trainee, enrollment_id)
    enrollment.status = EnrollmentStatus.DROPPED
    db.commit()
    return _reload_enrollment(db, enrollment.id)
