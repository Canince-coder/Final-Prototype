import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.security import require_role
from app.db.session import get_db
from app.models.announcement import Announcement
from app.models.document import EmploymentSubmission
from app.models.employment import Employment
from app.models.enums import (
    CourseStatus,
    EmploymentStatus,
    SkillSource,
    UserRole,
    VerificationStatus,
)
from app.models.job import Job
from app.models.skill import Skill, TraineeSkill
from app.models.trainee import Trainee
from app.models.training import ProgramSkill, TrainingProgram
from app.models.user import User
from app.schemas.portal import (
    AdminDashboardOut,
    AnnouncementIn,
    AnnouncementOut,
    AnnouncementUpdate,
    CourseIn,
    CourseRecommendationOut,
    CourseSkillIn,
    CourseUpdate,
    LocationEmploymentOut,
    ProfileListItem,
    ProgramOut,
    SkillAnalysisOut,
    SubmissionOut,
    SubmissionReviewIn,
)
from app.schemas.skill import SkillCatalogOut, SkillCreate
from app.services import files
from app.services.analytics import course_recommendations, employment_by_location, skill_analysis
from app.services.skills import apply_detected_skills

admin_user = require_role(UserRole.ADMIN)
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_user)])

DEMO_NOTE = "Rows with demo_records > 0 include seeded DEMO profiles (trainees.is_demo = true)."
_PROGRAM_LOAD = selectinload(TrainingProgram.skills).selectinload(ProgramSkill.skill)


def _count(db: Session, model, *where) -> int:
    return db.scalar(select(func.count()).select_from(model).where(*where)) or 0


# --- Dashboard & location analytics ---------------------------------------------

@router.get("/dashboard", response_model=AdminDashboardOut)
def admin_dashboard(db: Session = Depends(get_db)):
    role_counts = dict(
        db.execute(select(User.role, func.count()).join(Trainee, Trainee.user_id == User.id).group_by(User.role)).all()
    )
    total = sum(role_counts.values())
    employed = _count(db, Trainee, Trainee.employment_status == EmploymentStatus.EMPLOYED)
    now = datetime.now(timezone.utc)
    return AdminDashboardOut(
        total_trainees=role_counts.get(UserRole.TRAINEE, 0),
        total_employees=role_counts.get(UserRole.EMPLOYEE, 0),
        employed=employed,
        unemployed=total - employed,
        employment_rate=round(employed / total * 100, 1) if total else 0.0,
        total_jobs=_count(db, Job),
        active_courses=_count(db, TrainingProgram, TrainingProgram.status == CourseStatus.ACTIVE),
        pending_submissions=_count(
            db, EmploymentSubmission, EmploymentSubmission.verification_status == VerificationStatus.PENDING
        ),
        active_announcements=_count(
            db, Announcement, Announcement.is_active.is_(True),
            or_(Announcement.expires_at.is_(None), Announcement.expires_at > now),
        ),
        employment_by_state=employment_by_location(db),
        demo_data_note=DEMO_NOTE,
    )


@router.get("/analytics/employment-by-state", response_model=list[LocationEmploymentOut])
def employment_by_state(db: Session = Depends(get_db)):
    """Per state: total, employed, unemployed, employment rate (employed / total * 100). Computed from DB."""
    return employment_by_location(db)


@router.get("/analytics/employment-by-district", response_model=list[LocationEmploymentOut])
def employment_by_district(state: str | None = None, db: Session = Depends(get_db)):
    return employment_by_location(db, by_district=True, state=state)


@router.get("/trainees", response_model=list[ProfileListItem])
def list_profiles(
    state: str | None = None,
    district: str | None = None,
    employment_status: EmploymentStatus | None = None,
    role: UserRole | None = Query(None, description="TRAINEE or EMPLOYEE"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Drill-down list by state / district / employment status."""
    stmt = select(Trainee, User).join(User, User.id == Trainee.user_id)
    if state:
        stmt = stmt.where(func.lower(Trainee.state) == state.lower())
    if district:
        stmt = stmt.where(func.lower(Trainee.district) == district.lower())
    if employment_status:
        stmt = stmt.where(Trainee.employment_status == employment_status)
    if role:
        stmt = stmt.where(User.role == role)
    rows = db.execute(stmt.order_by(Trainee.state, Trainee.district, User.name).limit(limit).offset(offset)).all()
    return [
        ProfileListItem(
            **{c: getattr(t, c) for c in ("id", "trainee_uid", "employee_uid", "state", "district",
                                          "education", "employment_status", "is_demo")},
            name=u.name, email=u.email, role=u.role.value,
        )
        for t, u in rows
    ]


# --- Courses (training programs) ---------------------------------------------------

def _load_course(db: Session, course_id: uuid.UUID) -> TrainingProgram:
    course = db.scalar(select(TrainingProgram).where(TrainingProgram.id == course_id).options(_PROGRAM_LOAD))
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


def _set_course_skills(db: Session, course: TrainingProgram, skills: list[CourseSkillIn]) -> None:
    names = {s.skill_name.strip().lower(): s.target_level for s in skills}
    found = db.scalars(select(Skill).where(func.lower(Skill.name).in_(names))).all()
    missing = set(names) - {s.name.lower() for s in found}
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Unknown skills: {', '.join(sorted(missing))}. Create them via POST /admin/skills first.",
        )
    course.skills.clear()
    db.flush()
    course.skills.extend(ProgramSkill(skill_id=s.id, target_level=names[s.name.lower()]) for s in found)


@router.get("/courses", response_model=list[ProgramOut])
def list_courses(status_filter: CourseStatus | None = Query(None, alias="status"), db: Session = Depends(get_db)):
    stmt = select(TrainingProgram).options(_PROGRAM_LOAD).order_by(TrainingProgram.name)
    if status_filter:
        stmt = stmt.where(TrainingProgram.status == status_filter)
    return db.scalars(stmt).all()


@router.post("/courses", response_model=ProgramOut, status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseIn, db: Session = Depends(get_db)):
    course = TrainingProgram(
        name=payload.title, description=payload.description, provider=payload.provider,
        duration=payload.duration, difficulty=payload.difficulty, status=payload.status,
    )
    db.add(course)
    _set_course_skills(db, course, payload.skills)
    db.commit()
    return _load_course(db, course.id)


@router.get("/courses/{course_id}", response_model=ProgramOut)
def get_course(course_id: uuid.UUID, db: Session = Depends(get_db)):
    return _load_course(db, course_id)


@router.patch("/courses/{course_id}", response_model=ProgramOut)
def update_course(course_id: uuid.UUID, payload: CourseUpdate, db: Session = Depends(get_db)):
    course = _load_course(db, course_id)
    data = payload.model_dump(exclude_unset=True, exclude={"skills"})
    if "title" in data:
        data["name"] = data.pop("title")
    for field, value in data.items():
        if value is not None or field == "description":
            setattr(course, field, value)
    if payload.skills is not None:
        _set_course_skills(db, course, payload.skills)
    db.commit()
    db.expire_all()
    return _load_course(db, course_id)


@router.delete("/courses/{course_id}", response_model=ProgramOut)
def deactivate_course(course_id: uuid.UUID, db: Session = Depends(get_db)):
    """Soft delete: sets status INACTIVE so enrollment history is kept. Reactivate via PATCH."""
    course = _load_course(db, course_id)
    course.status = CourseStatus.INACTIVE
    db.commit()
    return _load_course(db, course_id)


# --- Announcements -------------------------------------------------------------

@router.get("/announcements", response_model=list[AnnouncementOut])
def list_all_announcements(db: Session = Depends(get_db)):
    return db.scalars(select(Announcement).order_by(Announcement.created_at.desc())).all()


@router.post("/announcements", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
def create_announcement(payload: AnnouncementIn, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    row = Announcement(**payload.model_dump(), created_by=admin.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _announcement(db: Session, announcement_id: uuid.UUID) -> Announcement:
    row = db.get(Announcement, announcement_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    return row


@router.get("/announcements/{announcement_id}", response_model=AnnouncementOut)
def get_announcement(announcement_id: uuid.UUID, db: Session = Depends(get_db)):
    return _announcement(db, announcement_id)


@router.patch("/announcements/{announcement_id}", response_model=AnnouncementOut)
def update_announcement(announcement_id: uuid.UUID, payload: AnnouncementUpdate, db: Session = Depends(get_db)):
    row = _announcement(db, announcement_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None or field == "expires_at":
            setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(announcement_id: uuid.UUID, db: Session = Depends(get_db)):
    db.delete(_announcement(db, announcement_id))
    db.commit()


# --- Skill analysis ------------------------------------------------------------

@router.get("/skills/analysis", response_model=list[SkillAnalysisOut])
def admin_skill_analysis(db: Session = Depends(get_db)):
    """Per-skill demand vs supply. jobs/trainees/employees counts come from the DB;
    market_demand and trend are DEMO seed values until a labour-market feed exists."""
    return skill_analysis(db)


@router.get("/skills/course-recommendations", response_model=list[CourseRecommendationOut])
def admin_course_recommendations(
    min_demand: int = Query(50, ge=0, le=100),
    min_gap: int = Query(20, ge=0, le=100),
    db: Session = Depends(get_db),
):
    """Skills with high demand and low availability, with a course to introduce or promote."""
    return course_recommendations(db, min_demand, min_gap)


# --- Submission review ---------------------------------------------------------

@router.get("/submissions", response_model=list[SubmissionOut])
def list_submissions(
    status_filter: VerificationStatus | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    stmt = select(EmploymentSubmission).order_by(EmploymentSubmission.uploaded_at.desc())
    if status_filter:
        stmt = stmt.where(EmploymentSubmission.verification_status == status_filter)
    return db.scalars(stmt).all()


def _submission(db: Session, submission_id: uuid.UUID) -> EmploymentSubmission:
    row = db.get(EmploymentSubmission, submission_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return row


@router.get("/submissions/{submission_id}/file", response_class=FileResponse)
def admin_download_submission(submission_id: uuid.UUID, db: Session = Depends(get_db)):
    row = _submission(db, submission_id)
    path = files.stored_path(row.stored_filename)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(path, media_type=row.content_type, filename=row.original_filename)


@router.patch("/submissions/{submission_id}/review", response_model=SubmissionOut)
def review_submission(
    submission_id: uuid.UUID,
    payload: SubmissionReviewIn,
    admin: User = Depends(admin_user),
    db: Session = Depends(get_db),
):
    """VERIFIED: extracted skills become verified and the linked employment is verified.
    REJECTED: skills that were only pending on this document are marked rejected."""
    row = _submission(db, submission_id)
    if row.verification_status != VerificationStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Already {row.verification_status.value}")
    row.verification_status = payload.status
    row.review_note = payload.note
    row.reviewed_by = admin.id
    row.reviewed_at = datetime.now(timezone.utc)
    profile = db.get(Trainee, row.employee_id)
    if payload.status == VerificationStatus.VERIFIED:
        row.skills_updated = apply_detected_skills(
            db, profile, row.extracted_skills, source=SkillSource.DOCUMENT, level=2,
            verification=VerificationStatus.VERIFIED,
        )
        if row.employment_id:
            db.get(Employment, row.employment_id).verification_status = VerificationStatus.VERIFIED
    elif row.extracted_skills:
        for ts in db.scalars(
            select(TraineeSkill).join(Skill).where(
                TraineeSkill.trainee_id == profile.id,
                Skill.name.in_(row.extracted_skills),
                TraineeSkill.source == SkillSource.DOCUMENT,
                TraineeSkill.verification_status == VerificationStatus.PENDING,
            )
        ):
            ts.verification_status = VerificationStatus.REJECTED
    touched = getattr(row, "skills_updated", [])
    db.commit()
    db.refresh(row)
    row.skills_updated = touched
    return row


# --- Skill vocabulary ----------------------------------------------------------

@router.post("/skills", response_model=SkillCatalogOut, status_code=status.HTTP_201_CREATED)
def create_skill(payload: SkillCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Skill).where(func.lower(Skill.name) == payload.name.strip().lower())):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Skill already exists")
    skill = Skill(**payload.model_dump() | {"name": payload.name.strip()})
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill
