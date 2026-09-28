import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_trainee
from app.db.session import get_db
from app.models.job import Job, JobRequirement
from app.models.trainee import Trainee
from app.schemas.job import JobMatchOut, JobOut, JobSkillGapOut, SkillGapOut
from app.services.matching import SkillMatch, compute_match, load_trainee_skill_levels

router = APIRouter(prefix="/jobs", tags=["jobs"])

_JOB_LOAD = (
    selectinload(Job.employer),
    selectinload(Job.job_role),
    selectinload(Job.requirements).selectinload(JobRequirement.skill),
)


def _load_job(db: Session, job_id: uuid.UUID) -> Job:
    job = db.scalar(select(Job).where(Job.id == job_id).options(*_JOB_LOAD))
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


def _gap_out(s: SkillMatch) -> SkillGapOut:
    return SkillGapOut(
        skill_id=s.skill_id,
        skill_name=s.skill_name,
        required_level=s.required_level,
        candidate_level=s.candidate_level,
        gap=s.gap,
        required=s.required,
    )


@router.get("", response_model=list[JobOut])
def list_jobs(db: Session = Depends(get_db)):
    return db.scalars(
        select(Job).options(*_JOB_LOAD).order_by(Job.created_at.desc())
    ).all()


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    return _load_job(db, job_id)


@router.get("/{job_id}/match", response_model=JobMatchOut)
def get_job_match(
    job_id: uuid.UUID,
    trainee: Trainee = Depends(get_current_trainee),
    db: Session = Depends(get_db),
):
    job = _load_job(db, job_id)
    levels = load_trainee_skill_levels(db, trainee.id)
    result = compute_match(levels, job.requirements)
    return JobMatchOut(
        job_id=job.id,
        job_title=job.title,
        match_percentage=round(result.match_percentage),
        strengths=[_gap_out(s) for s in result.strengths],
        skill_gaps=[_gap_out(s) for s in result.gaps],
    )


@router.get("/{job_id}/skill-gap", response_model=JobSkillGapOut)
def get_job_skill_gap(
    job_id: uuid.UUID,
    trainee: Trainee = Depends(get_current_trainee),
    db: Session = Depends(get_db),
):
    job = _load_job(db, job_id)
    levels = load_trainee_skill_levels(db, trainee.id)
    result = compute_match(levels, job.requirements)
    return JobSkillGapOut(
        job_id=job.id,
        job_title=job.title,
        match_percentage=round(result.match_percentage),
        skill_gaps=[_gap_out(s) for s in result.gaps],
    )
