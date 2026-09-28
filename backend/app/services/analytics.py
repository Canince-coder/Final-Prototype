import uuid
from dataclasses import dataclass, field
 
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.application import JobApplication
from app.models.employer import Employer
from app.models.employment import Employment
from app.models.enums import ApplicationStatus, CourseStatus, EmploymentStatus, SkillSource, UserRole
from app.models.job import Job, JobRequirement
from app.models.skill import Skill, TraineeSkill
from app.models.trainee import Trainee
from app.models.training import ProgramSkill, TrainingProgram
from app.models.user import User
from app.services.skills import experience_months
 
 
@dataclass
class PlatformOverview:
    total_trainees: int
    total_employers: int
    total_jobs: int
    total_skills: int
    total_applications: int
    total_employments: int
    employed_trainees: int
    employment_rate: float  # percentage, 0.0 when there are no trainees
 
 
@dataclass
class SkillDemandSupply:
    skill_id: uuid.UUID
    skill_name: str
    demand_count: int  # how many job_requirements reference this skill
    supply_count: int  # how many trainees hold this skill
    gap: int  # demand_count - supply_count
 
 
@dataclass
class EmployerAnalytics:
    total_jobs: int
    total_applications: int
    applications_by_status: dict[ApplicationStatus, int]
    total_employments: int
 
 
_ALL_STATUSES = list(ApplicationStatus)
 
 
def get_platform_overview(db: Session) -> PlatformOverview:
    total_trainees = db.scalar(select(func.count()).select_from(Trainee)) or 0
    total_employers = db.scalar(select(func.count()).select_from(Employer)) or 0
    total_jobs = db.scalar(select(func.count()).select_from(Job)) or 0
    total_skills = db.scalar(select(func.count()).select_from(Skill)) or 0
    total_applications = db.scalar(select(func.count()).select_from(JobApplication)) or 0
    total_employments = db.scalar(select(func.count()).select_from(Employment)) or 0
    employed_trainees = db.scalar(
        select(func.count()).select_from(Trainee).where(Trainee.employment_status == EmploymentStatus.EMPLOYED)
    ) or 0
    employment_rate = (employed_trainees / total_trainees * 100.0) if total_trainees else 0.0
 
    return PlatformOverview(
        total_trainees=total_trainees,
        total_employers=total_employers,
        total_jobs=total_jobs,
        total_skills=total_skills,
        total_applications=total_applications,
        total_employments=total_employments,
        employed_trainees=employed_trainees,
        employment_rate=employment_rate,
    )
 
 
def get_applications_by_status(db: Session) -> dict[ApplicationStatus, int]:
    rows = db.execute(
        select(JobApplication.status, func.count()).group_by(JobApplication.status)
    ).all()
    counts = {status: 0 for status in _ALL_STATUSES}
    for status, count in rows:
        counts[status] = count
    return counts
 
 
def get_skills_demand_supply(db: Session, limit: int = 10) -> list[SkillDemandSupply]:
    demand_rows = db.execute(
        select(JobRequirement.skill_id, func.count(JobRequirement.id)).group_by(JobRequirement.skill_id)
    ).all()
    demand = {skill_id: count for skill_id, count in demand_rows}
 
    supply_rows = db.execute(
        select(TraineeSkill.skill_id, func.count(TraineeSkill.id)).group_by(TraineeSkill.skill_id)
    ).all()
    supply = {skill_id: count for skill_id, count in supply_rows}
 
    skills = db.execute(select(Skill.id, Skill.name)).all()
 
    results = [
        SkillDemandSupply(
            skill_id=skill_id,
            skill_name=name,
            demand_count=demand.get(skill_id, 0),
            supply_count=supply.get(skill_id, 0),
            gap=demand.get(skill_id, 0) - supply.get(skill_id, 0),
        )
        for skill_id, name in skills
    ]
    results.sort(key=lambda r: (-r.gap, -r.demand_count, r.skill_name))
    return results[:limit]
 
 
def get_employer_analytics(db: Session, employer_id: uuid.UUID) -> EmployerAnalytics:
    total_jobs = db.scalar(
        select(func.count()).select_from(Job).where(Job.employer_id == employer_id)
    ) or 0
 
    total_applications = db.scalar(
        select(func.count())
        .select_from(JobApplication)
        .join(Job, JobApplication.job_id == Job.id)
        .where(Job.employer_id == employer_id)
    ) or 0
 
    status_rows = db.execute(
        select(JobApplication.status, func.count())
        .join(Job, JobApplication.job_id == Job.id)
        .where(Job.employer_id == employer_id)
        .group_by(JobApplication.status)
    ).all()
    applications_by_status = {status: 0 for status in _ALL_STATUSES}
    for status, count in status_rows:
        applications_by_status[status] = count
 
    total_employments = db.scalar(
        select(func.count()).select_from(Employment).where(Employment.employer_id == employer_id)
    ) or 0
 
    return EmployerAnalytics(
        total_jobs=total_jobs,
        total_applications=total_applications,
        applications_by_status=applications_by_status,
        total_employments=total_employments,
    )


# ---------------------------------------------------------------------------
# Admin: employment by location
# ---------------------------------------------------------------------------

def employment_by_location(db: Session, *, by_district: bool = False, state: str | None = None) -> list[dict]:
    """Totals per state (or per state+district). Employment rate = employed / total * 100."""
    state_col = func.coalesce(Trainee.state, "Unknown")
    cols = [state_col, Trainee.district] if by_district else [state_col]
    employed = func.sum(case((Trainee.employment_status == EmploymentStatus.EMPLOYED, 1), else_=0))
    demo = func.sum(case((Trainee.is_demo.is_(True), 1), else_=0))
    stmt = select(*cols, func.count(Trainee.id), employed, demo).group_by(*cols).order_by(*cols)
    if state:
        stmt = stmt.where(func.lower(Trainee.state) == state.lower())
    rows = []
    for row in db.execute(stmt).all():
        total, emp, demo_n = int(row[-3]), int(row[-2] or 0), int(row[-1] or 0)
        item = {"state": row[0]}
        if by_district:
            item["district"] = row[1]
        item.update(
            total_trainees=total,
            employed_trainees=emp,
            unemployed_trainees=total - emp,
            employment_rate=round(emp / total * 100, 1) if total else 0.0,
            demo_records=demo_n,
        )
        rows.append(item)
    return rows


# ---------------------------------------------------------------------------
# Admin: skill analysis + course recommendations
# ---------------------------------------------------------------------------

def skill_analysis(db: Session) -> list[dict]:
    """Per-skill demand vs availability.

    jobs_count           jobs requiring the skill (DB)
    trainees/employees   profiles holding the skill (DB)
    internal_demand      jobs_count / total_jobs * 100 (DB)
    demand_score         mean(market_demand, internal_demand); market_demand is DEMO seed data
    availability         holders / total profiles * 100 (DB)
    skill_gap            max(0, demand_score - availability)
    """
    total_jobs = db.scalar(select(func.count()).select_from(Job)) or 0
    total_profiles = db.scalar(select(func.count()).select_from(Trainee)) or 0
    jobs_by_skill = dict(
        db.execute(select(JobRequirement.skill_id, func.count(func.distinct(JobRequirement.job_id))).group_by(JobRequirement.skill_id)).all()
    )
    holders = db.execute(
        select(TraineeSkill.skill_id, User.role, func.count())
        .join(Trainee, Trainee.id == TraineeSkill.trainee_id)
        .join(User, User.id == Trainee.user_id)
        .group_by(TraineeSkill.skill_id, User.role)
    ).all()
    by_role: dict = {}
    for skill_id, role, n in holders:
        by_role.setdefault(skill_id, {})[role] = n

    out = []
    for skill in db.scalars(select(Skill).order_by(Skill.name)):
        jobs_n = jobs_by_skill.get(skill.id, 0)
        trainees_n = by_role.get(skill.id, {}).get(UserRole.TRAINEE, 0)
        employees_n = by_role.get(skill.id, {}).get(UserRole.EMPLOYEE, 0)
        internal = jobs_n / total_jobs * 100 if total_jobs else 0.0
        demand = (skill.market_demand + internal) / 2 if skill.market_demand is not None else internal
        availability = round((trainees_n + employees_n) / total_profiles * 100) if total_profiles else 0
        demand = round(demand)
        out.append({
            "skill_id": skill.id,
            "skill": skill.name,
            "demand_score": demand,
            "market_demand": skill.market_demand,
            "internal_demand": round(internal),
            "jobs_count": jobs_n,
            "trainees_count": trainees_n,
            "employees_count": employees_n,
            "availability": availability,
            "skill_gap": max(0, demand - availability),
            "trend": skill.trend,
        })
    out.sort(key=lambda r: (-r["skill_gap"], -r["demand_score"], r["skill"]))
    return out


def course_recommendations(db: Session, min_demand: int = 50, min_gap: int = 20) -> list[dict]:
    """High demand + low availability -> course to introduce (or existing course to promote)."""
    courses = db.scalars(
        select(TrainingProgram).options(selectinload(TrainingProgram.skills).selectinload(ProgramSkill.skill))
    ).all()
    out = []
    for row in skill_analysis(db):
        if row["demand_score"] < min_demand or row["skill_gap"] < min_gap:
            continue
        existing = [
            {"id": c.id, "title": c.name, "status": c.status}
            for c in courses if any(ps.skill_id == row["skill_id"] for ps in c.skills)
        ]
        # nobody has it yet -> start at fundamentals; some supply -> push people up a level
        level = "Advanced" if row["availability"] >= 10 else "Foundations of"
        suffix = " Development" if level == "Advanced" else ""
        out.append({
            "skill": row["skill"],
            "demand_score": row["demand_score"],
            "skill_gap": row["skill_gap"],
            "availability": row["availability"],
            "trend": row["trend"],
            "recommended_course": f"{level} {row['skill']}{suffix}",
            "existing_courses": existing,
            "action": "PROMOTE_EXISTING" if any(c["status"] == CourseStatus.ACTIVE for c in existing) else "CREATE_COURSE",
        })
    return out


# ---------------------------------------------------------------------------
# Employee analytics
# ---------------------------------------------------------------------------

_GAINED_SOURCES = {SkillSource.DOCUMENT, SkillSource.EMPLOYMENT, SkillSource.PROJECT_ASSESSMENT, SkillSource.TRAINING}


def employee_analytics(db: Session, profile: Trainee) -> dict:
    jobs = db.scalars(
        select(Employment).where(Employment.trainee_id == profile.id).order_by(Employment.joining_date)
    ).all()
    months = experience_months(jobs)
    skills = db.scalars(
        select(TraineeSkill).where(TraineeSkill.trainee_id == profile.id).options(selectinload(TraineeSkill.skill))
    ).all()
    gained = {s for e in jobs for s in (e.skills_used or [])}
    gained |= {ts.skill.name for ts in skills if ts.source in _GAINED_SOURCES}

    timeline = []
    for e in jobs:
        timeline.append({"date": e.joining_date, "event": "JOINED", "company": e.company_name, "role": e.role_title})
        if e.end_date:
            timeline.append({"date": e.end_date, "event": "LEFT", "company": e.company_name, "role": e.role_title})
    timeline.sort(key=lambda t: t["date"])

    current = [e for e in jobs if e.end_date is None]
    return {
        "employee_uid": profile.employee_uid,
        "total_experience_months": months,
        "total_experience_years": round(months / 12, 1),
        "companies_count": len({e.company_name for e in jobs}),
        "past_companies": sorted({e.company_name for e in jobs if e.end_date is not None}),
        "current_companies": sorted({e.company_name for e in current}),
        "employment_history": jobs,
        "skills_gained": sorted(gained),
        "employment_timeline": timeline,
    }