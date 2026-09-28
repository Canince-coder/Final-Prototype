import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_employee
from app.db.session import get_db
from app.models.document import EmploymentSubmission
from app.models.employment import Employment
from app.models.enums import DocumentType, EnrollmentStatus, SkillSource, VerificationStatus
from app.models.project import Project
from app.models.trainee import Trainee
from app.models.training import TrainingEnrollment
from app.routers.profile import skills_out
from app.schemas.job import EmployeeJobOut
from app.schemas.portal import EmployeeAnalyticsOut, EmployeeDashboardOut, SubmissionOut
from app.schemas.trainee import TraineeOut
from app.services import files
from app.services.analytics import employee_analytics
from app.services.matching import employee_job_eligibility
from app.services.skills import apply_detected_skills, education_level, experience_months, extract_skills

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("/me", response_model=TraineeOut)
def read_my_employee_profile(employee: Trainee = Depends(get_current_employee)):
    return employee


def _eligible_jobs(db: Session, employee: Trainee, limit: int) -> list[dict]:
    jobs = db.scalars(select(Employment).where(Employment.trainee_id == employee.id)).all()
    return employee_job_eligibility(
        db, employee.id, experience_months(jobs) / 12, education_level(employee.education), limit
    )


@router.get("/me/dashboard", response_model=EmployeeDashboardOut)
def employee_dashboard(employee: Trainee = Depends(get_current_employee), db: Session = Depends(get_db)):
    jobs = db.scalars(
        select(Employment).where(Employment.trainee_id == employee.id).order_by(Employment.joining_date.desc())
    ).all()
    months = experience_months(jobs)
    completed_training = db.scalar(
        select(func.count()).select_from(TrainingEnrollment).where(
            TrainingEnrollment.trainee_id == employee.id, TrainingEnrollment.status == EnrollmentStatus.COMPLETED
        )
    )
    projects = db.scalar(select(func.count()).select_from(Project).where(Project.trainee_id == employee.id))
    pending = db.scalar(
        select(func.count()).select_from(EmploymentSubmission).where(
            EmploymentSubmission.employee_id == employee.id,
            EmploymentSubmission.verification_status == VerificationStatus.PENDING,
        )
    )
    return EmployeeDashboardOut(
        employee_id=employee.employee_uid,
        trainee_uid=employee.trainee_uid,
        name=employee.user.name,
        email=employee.user.email,
        phone=employee.phone,
        state=employee.state,
        district=employee.district,
        education=employee.education,
        employment_status=employee.employment_status,
        skills=skills_out(db, employee),
        total_experience_months=months,
        total_experience_years=round(months / 12, 1),
        current_employment=[e for e in jobs if e.end_date is None],
        past_employment=[e for e in jobs if e.end_date is not None],
        related_trainee_info={
            "trainee_uid": employee.trainee_uid,
            "trainings_completed": completed_training,
            "projects_submitted": projects,
            "profile_created_at": employee.created_at,
        },
        pending_submissions=pending,
        top_jobs=_eligible_jobs(db, employee, 5),
    )


@router.get("/me/jobs", response_model=list[EmployeeJobOut])
def my_applicable_jobs(
    eligible_only: bool = False,
    limit: int = Query(20, ge=1, le=100),
    employee: Trainee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Eligibility = 60% skill match + 25% experience + 15% education (rule-based). Eligible at >= 60."""
    jobs = _eligible_jobs(db, employee, 100)
    if eligible_only:
        jobs = [j for j in jobs if j["eligible"]]
    return jobs[:limit]


@router.get("/me/analytics", response_model=EmployeeAnalyticsOut)
def my_employee_analytics(employee: Trainee = Depends(get_current_employee), db: Session = Depends(get_db)):
    return employee_analytics(db, employee)


# --- Submission / Skill Assessment ---------------------------------------------

@router.post("/me/submissions", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def upload_submission(
    file: UploadFile = File(..., description=".pdf, .docx, .txt, .png, .jpg"),
    file_type: DocumentType = Form(...),
    description: str | None = Form(None, max_length=5000),
    employment_id: uuid.UUID | None = Form(None),
    employee: Trainee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Upload employment proof or a project document. Skills mentioned in the document
    text/description are extracted (rule-based) and added to the skill profile as PENDING
    until an admin verifies the submission."""
    if employment_id is not None:
        job = db.get(Employment, employment_id)
        if job is None or job.trainee_id != employee.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employment record not found")
    stored, size = files.save_upload(file, "submissions", files.PROOF_EXTS)
    skills = extract_skills(db, description, files.extract_text(stored))
    submission = EmploymentSubmission(
        employee_id=employee.id,
        employment_id=employment_id,
        file_type=file_type,
        description=description,
        original_filename=file.filename,
        stored_filename=stored,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=size,
        extracted_skills=skills,
    )
    db.add(submission)
    touched = apply_detected_skills(
        db, employee, skills, source=SkillSource.DOCUMENT, level=2, verification=VerificationStatus.PENDING
    )
    db.commit()
    db.refresh(submission)
    submission.skills_updated = touched
    return submission


@router.get("/me/submissions", response_model=list[SubmissionOut])
def my_submissions(employee: Trainee = Depends(get_current_employee), db: Session = Depends(get_db)):
    return db.scalars(
        select(EmploymentSubmission)
        .where(EmploymentSubmission.employee_id == employee.id)
        .order_by(EmploymentSubmission.uploaded_at.desc())
    ).all()


def _own_submission(db: Session, employee: Trainee, submission_id: uuid.UUID) -> EmploymentSubmission:
    submission = db.get(EmploymentSubmission, submission_id)
    if submission is None or submission.employee_id != employee.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return submission


@router.get("/me/submissions/{submission_id}", response_model=SubmissionOut)
def get_submission(
    submission_id: uuid.UUID, employee: Trainee = Depends(get_current_employee), db: Session = Depends(get_db)
):
    return _own_submission(db, employee, submission_id)


@router.get("/me/submissions/{submission_id}/file", response_class=FileResponse)
def download_submission(
    submission_id: uuid.UUID, employee: Trainee = Depends(get_current_employee), db: Session = Depends(get_db)
):
    submission = _own_submission(db, employee, submission_id)
    path = files.stored_path(submission.stored_filename)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(path, media_type=submission.content_type, filename=submission.original_filename)
