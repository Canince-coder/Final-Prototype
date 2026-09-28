from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
 
from app.core.deps import get_current_employer
from app.core.security import require_role
from app.db.session import get_db
from app.models.employer import Employer
from app.models.enums import UserRole
from app.schemas.analytics import (
    ApplicationsByStatusOut,
    EmployerAnalyticsOut,
    PlatformOverviewOut,
    SkillDemandSupplyOut,
)
from app.services.analytics import (
    get_applications_by_status,
    get_employer_analytics,
    get_platform_overview,
    get_skills_demand_supply,
)
 
router = APIRouter(tags=["analytics"])
 
 
@router.get(
    "/analytics/overview",
    response_model=PlatformOverviewOut,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
def analytics_overview(db: Session = Depends(get_db)):
    overview = get_platform_overview(db)
    return PlatformOverviewOut(**overview.__dict__)
 
 
@router.get(
    "/analytics/applications-by-status",
    response_model=ApplicationsByStatusOut,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
def analytics_applications_by_status(db: Session = Depends(get_db)):
    counts = get_applications_by_status(db)
    return ApplicationsByStatusOut(counts=counts)
 
 
@router.get(
    "/analytics/skills-demand-supply",
    response_model=list[SkillDemandSupplyOut],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
def analytics_skills_demand_supply(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    rows = get_skills_demand_supply(db, limit=limit)
    return [SkillDemandSupplyOut(**row.__dict__) for row in rows]
 
 
@router.get("/employers/me/analytics", response_model=EmployerAnalyticsOut)
def employer_analytics(
    employer: Employer = Depends(get_current_employer),
    db: Session = Depends(get_db),
):
    stats = get_employer_analytics(db, employer.id)
    return EmployerAnalyticsOut(**stats.__dict__)