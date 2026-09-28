from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import require_role
from app.db.session import get_db
from app.models.enums import EmploymentStatus, UserRole
from app.models.employer import Employer
from app.models.trainee import Trainee, new_employee_uid, new_trainee_uid
from app.models.user import User


def _load_profile(db: Session, user: User, not_found: str) -> Trainee:
    profile = db.scalar(
        select(Trainee).where(Trainee.user_id == user.id).options(selectinload(Trainee.user))
    )
    if profile is None:
        if user.role != UserRole.EMPLOYEE:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=not_found)
        # employees registered before profiles existed: create one on first access
        profile = Trainee(
            user_id=user.id, district="Not specified", education="Not specified",
            employment_status=EmploymentStatus.EMPLOYED,
        )
        db.add(profile)
    # First login without IDs: generate them.
    changed = False
    if not profile.trainee_uid:
        profile.trainee_uid, changed = new_trainee_uid(), True
    if user.role == UserRole.EMPLOYEE and not profile.employee_uid:
        profile.employee_uid, changed = new_employee_uid(), True
    if changed or profile in db.new:
        db.commit()
        db.refresh(profile)
    return profile


def get_current_trainee(
    current_user: User = Depends(require_role(UserRole.TRAINEE)),
    db: Session = Depends(get_db),
) -> Trainee:
    return _load_profile(db, current_user, "Trainee profile not found")


def get_current_employee(
    current_user: User = Depends(require_role(UserRole.EMPLOYEE)),
    db: Session = Depends(get_db),
) -> Trainee:
    return _load_profile(db, current_user, "Employee profile not found")


def get_current_employer(
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
) -> Employer:
    employer = db.scalar(
        select(Employer)
        .where(Employer.user_id == current_user.id)
        .options(selectinload(Employer.user))
    )
    if employer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employer profile not found",
        )
    return employer
