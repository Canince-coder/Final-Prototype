import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_trainee
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.application import JobApplication
from app.models.enums import ApplicationStatus, UserRole
from app.models.job import Job
from app.models.trainee import Trainee
from app.models.user import User
from app.schemas.application import ApplicationOut, ApplicationStatusUpdate

router = APIRouter(tags=["applications"])

_ALLOWED_TRANSITIONS: dict[ApplicationStatus, set[ApplicationStatus]] = {
    ApplicationStatus.APPLIED: {
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
    },
    ApplicationStatus.SHORTLISTED: {
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
    },
    ApplicationStatus.INTERVIEW: {
        ApplicationStatus.SELECTED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
    },
    ApplicationStatus.SELECTED: set(),
    ApplicationStatus.REJECTED: set(),
    ApplicationStatus.WITHDRAWN: set(),
}

_APP_LOAD = (
    selectinload(JobApplication.job).selectinload(Job.employer),
    selectinload(JobApplication.trainee),
)


def _reload(db: Session, application_id: uuid.UUID) -> JobApplication:
    return db.scalar(
        select(JobApplication).where(JobApplication.id == application_id).options(*_APP_LOAD)
    )


@router.post("/jobs/{job_id}/apply", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def apply_to_job(
    job_id: uuid.UUID,
    trainee: Trainee = Depends(get_current_trainee),
    db: Session = Depends(get_db),
):
    if db.get(Job, job_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    existing = db.scalar(
        select(JobApplication).where(
            JobApplication.job_id == job_id,
            JobApplication.trainee_id == trainee.id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already applied to this job",
        )

    application = JobApplication(job_id=job_id, trainee_id=trainee.id, status=ApplicationStatus.APPLIED)
    db.add(application)
    db.commit()
    return _reload(db, application.id)


@router.get("/trainees/me/applications", response_model=list[ApplicationOut])
def list_my_applications(
    trainee: Trainee = Depends(get_current_trainee),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(JobApplication)
        .where(JobApplication.trainee_id == trainee.id)
        .options(*_APP_LOAD)
        .order_by(JobApplication.applied_at.desc())
    ).all()


@router.patch("/applications/{application_id}/status", response_model=ApplicationOut)
def update_application_status(
    application_id: uuid.UUID,
    payload: ApplicationStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    application = _reload(db, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    target = payload.status

    if current_user.role == UserRole.ADMIN:
        pass
    elif current_user.role == UserRole.EMPLOYER:
        if application.job.employer.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your job posting")
    elif current_user.role == UserRole.TRAINEE:
        if application.trainee.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your application")
        if target != ApplicationStatus.WITHDRAWN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Trainees can only withdraw an application",
            )
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    if target not in _ALLOWED_TRANSITIONS[application.status]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status change: {application.status.value} -> {target.value}",
        )

    application.status = target
    db.commit()
    return _reload(db, application.id)
