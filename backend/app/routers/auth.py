from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.employer import Employer
from app.models.enums import EmploymentStatus, UserRole
from app.models.trainee import Trainee, new_employee_uid
from app.models.user import User
from app.schemas.auth import (
    ChangeEmailRequest,
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    Token,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def require_current_password(user: User, password: str) -> None:
    """Re-authentication gate for sensitive changes (email, phone, password)."""
    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Current password is incorrect")


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if payload.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be self-registered",
        )
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.flush()  # populate user.id

    if payload.role in (UserRole.TRAINEE, UserRole.EMPLOYEE):
        is_employee = payload.role == UserRole.EMPLOYEE
        db.add(
            Trainee(
                user_id=user.id,
                state=payload.state,
                district=payload.district or "Not specified",
                education=payload.education or "Not specified",
                phone=payload.phone,
                employee_uid=new_employee_uid() if is_employee else None,
                employment_status=EmploymentStatus.EMPLOYED if is_employee else EmploymentStatus.UNEMPLOYED,
            )
        )
    elif payload.role == UserRole.EMPLOYER:
        db.add(
            Employer(
                user_id=user.id,
                company_name=payload.company_name or payload.name,
                location=payload.location or "Not specified",
            )
        )

    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return Token(access_token=token, role=user.role)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


# ponytail: existing JWTs stay valid until expiry after a password change; add a
# token_version claim checked in get_current_user if revocation is needed.
@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_current_password(current_user, payload.current_password)
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()


@router.post("/change-email", response_model=UserOut)
def change_email(
    payload: ChangeEmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_current_password(current_user, payload.current_password)
    taken = db.scalar(select(User).where(User.email == payload.new_email, User.id != current_user.id))
    if taken is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    current_user.email = payload.new_email
    db.commit()
    db.refresh(current_user)
    return current_user
