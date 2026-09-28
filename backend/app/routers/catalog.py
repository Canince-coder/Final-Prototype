"""Read-only catalog endpoints available to any logged-in user."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.announcement import Announcement
from app.models.enums import Audience, CourseStatus, UserRole
from app.models.skill import Skill
from app.models.training import ProgramSkill, TrainingProgram
from app.models.user import User
from app.schemas.portal import AnnouncementOut, ProgramOut
from app.schemas.skill import SkillCatalogOut

router = APIRouter(tags=["catalog"], dependencies=[Depends(get_current_user)])

_PROGRAM_LOAD = selectinload(TrainingProgram.skills).selectinload(ProgramSkill.skill)
_AUDIENCE_FOR_ROLE = {UserRole.TRAINEE: Audience.TRAINEES, UserRole.EMPLOYEE: Audience.EMPLOYEES}


@router.get("/skills", response_model=list[SkillCatalogOut])
def list_skills(db: Session = Depends(get_db)):
    return db.scalars(select(Skill).order_by(Skill.name)).all()


@router.get("/training/programs", response_model=list[ProgramOut])
def list_training_programs(db: Session = Depends(get_db)):
    """Active training programs (Training Camp catalog)."""
    return db.scalars(
        select(TrainingProgram)
        .where(TrainingProgram.status == CourseStatus.ACTIVE)
        .options(_PROGRAM_LOAD)
        .order_by(TrainingProgram.name)
    ).all()


@router.get("/training/programs/{program_id}", response_model=ProgramOut)
def get_training_program(program_id: uuid.UUID, db: Session = Depends(get_db)):
    program = db.scalar(select(TrainingProgram).where(TrainingProgram.id == program_id).options(_PROGRAM_LOAD))
    if program is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training program not found")
    return program


@router.get("/announcements", response_model=list[AnnouncementOut])
def my_announcements(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Active, unexpired announcements targeted at the caller's role (admins see all)."""
    stmt = select(Announcement).where(
        Announcement.is_active.is_(True),
        or_(Announcement.expires_at.is_(None), Announcement.expires_at > datetime.now(timezone.utc)),
    )
    if user.role != UserRole.ADMIN:
        audiences = [Audience.ALL] + ([_AUDIENCE_FOR_ROLE[user.role]] if user.role in _AUDIENCE_FOR_ROLE else [])
        stmt = stmt.where(Announcement.target_audience.in_(audiences))
    return db.scalars(stmt.order_by(Announcement.created_at.desc())).all()
