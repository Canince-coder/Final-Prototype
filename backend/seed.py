"""
Demo data seeder for the SIH26135 Skilling-to-Employment backend.

EVERYTHING THIS SCRIPT CREATES IS DEMO DATA:
  * demo accounts use the @sih26135-demo.com domain
  * demo trainee/employee profiles have trainees.is_demo = true
  * skills.market_demand / skills.trend values are illustrative, not real market data

Creates/updates:
  * the development ADMIN from ADMIN_EMAIL / ADMIN_PASSWORD in backend/.env
    (no admin password lives in source code; skipped with a warning if unset)
  * the original demo set: 2 employers, 3 trainees, 4 job roles, jobs + requirements,
    trainee skills, one SELECTED application with its Employment record
  * extra skills with demo market data, more jobs, training programs (courses)
  * ~40 generated demo trainees across states/districts (for location analytics)
  * 3 demo employees with employment history
  * 2 demo announcements

Idempotent: everything is looked up by a natural/unique key first; re-running is safe.

    python seed.py
"""

import random
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.db.session import SessionLocal
from app.models.announcement import Announcement
from app.models.application import JobApplication
from app.models.employer import Employer
from app.models.employment import Employment
from app.models.enums import (
    ApplicationStatus,
    Audience,
    Difficulty,
    EmploymentStatus,
    EmploymentType,
    SkillTrend,
    UserRole,
    VerificationStatus,
)
from app.models.job import Job, JobRequirement, JobRole
from app.models.skill import Skill, TraineeSkill
from app.models.trainee import Trainee, new_employee_uid
from app.models.training import ProgramSkill, TrainingProgram
from app.models.user import User

# Shared password for DEMO (non-admin) accounts only. Development data.
DEMO_PASSWORD = "Demo@1234"
DEMO_DOMAIN = "sih26135-demo.com"
_demo_hash: str | None = None


def _demo_password_hash() -> str:
    global _demo_hash
    if _demo_hash is None:  # bcrypt is slow; hash once for all demo users
        _demo_hash = hash_password(DEMO_PASSWORD)
    return _demo_hash


# ---------------------------------------------------------------------------
# get-or-create helpers (idempotency)
# ---------------------------------------------------------------------------

def get_or_create_user(db: Session, *, email: str, name: str, role: UserRole) -> tuple[User, bool]:
    user = db.scalar(select(User).where(User.email == email))
    if user is not None:
        return user, False
    user = User(name=name, email=email, password_hash=_demo_password_hash(), role=role)
    db.add(user)
    db.flush()
    return user, True


def ensure_admin(db: Session) -> User | None:
    if not settings.admin_email or not settings.admin_password:
        print("WARNING: ADMIN_EMAIL / ADMIN_PASSWORD not set in backend/.env - admin not created.")
        return None
    admin = db.scalar(select(User).where(User.email == settings.admin_email))
    if admin is None:
        admin = User(name=settings.admin_name, email=settings.admin_email, role=UserRole.ADMIN,
                     password_hash=hash_password(settings.admin_password))
        db.add(admin)
    else:
        admin.role = UserRole.ADMIN
        if not verify_password(settings.admin_password, admin.password_hash):
            admin.password_hash = hash_password(settings.admin_password)
    db.flush()
    return admin


def ensure_profile(
    db: Session, user: User, *, state: str, district: str, education: str, phone: str,
    employed: bool = False, employee: bool = False,
) -> Trainee:
    profile = db.scalar(select(Trainee).where(Trainee.user_id == user.id))
    if profile is None:
        profile = Trainee(user_id=user.id, district=district, education=education, phone=phone)
        db.add(profile)
    profile.state = profile.state or state
    profile.is_demo = True
    if employee and not profile.employee_uid:
        profile.employee_uid = new_employee_uid()
    profile.employment_status = EmploymentStatus.EMPLOYED if employed else EmploymentStatus.UNEMPLOYED
    db.flush()
    return profile


def ensure_employer_profile(db: Session, user: User, *, company_name: str, location: str) -> Employer:
    employer = db.scalar(select(Employer).where(Employer.user_id == user.id))
    if employer is None:
        employer = Employer(user_id=user.id, company_name=company_name, location=location)
        db.add(employer)
        db.flush()
    return employer


def upsert_skill(db: Session, *, name: str, description: str, demand: int, trend: SkillTrend) -> Skill:
    skill = db.scalar(select(Skill).where(Skill.name == name))
    if skill is None:
        skill = Skill(name=name, description=description)
        db.add(skill)
    skill.market_demand, skill.trend = demand, trend  # DEMO market data
    db.flush()
    return skill


def get_or_create_job_role(db: Session, *, title: str, description: str) -> JobRole:
    role = db.scalar(select(JobRole).where(JobRole.title == title))
    if role is None:
        role = JobRole(title=title, description=description)
        db.add(role)
        db.flush()
    return role


def upsert_job(
    db: Session, *, employer: Employer, job_role: JobRole, title: str, location: str,
    salary_min: float, salary_max: float, description: str, min_exp: float = 0, min_edu: int = 0,
) -> Job:
    job = db.scalar(select(Job).where(Job.employer_id == employer.id, Job.title == title))
    if job is None:
        job = Job(employer_id=employer.id, job_role_id=job_role.id, title=title, location=location,
                  salary_min=salary_min, salary_max=salary_max, description=description)
        db.add(job)
    job.min_experience_years, job.min_education_level = min_exp, min_edu
    db.flush()
    return job


def upsert_job_requirement(db: Session, *, job: Job, skill: Skill, required_level: int, required: bool) -> None:
    req = db.scalar(select(JobRequirement).where(JobRequirement.job_id == job.id, JobRequirement.skill_id == skill.id))
    if req is None:
        db.add(JobRequirement(job_id=job.id, skill_id=skill.id, required_level=required_level, required=required))
    else:
        req.required_level, req.required = required_level, required
    db.flush()


def upsert_trainee_skill(db: Session, *, trainee: Trainee, skill: Skill, proficiency_level: int) -> None:
    row = db.scalar(select(TraineeSkill).where(TraineeSkill.trainee_id == trainee.id, TraineeSkill.skill_id == skill.id))
    if row is None:
        db.add(TraineeSkill(trainee_id=trainee.id, skill_id=skill.id, proficiency_level=proficiency_level))
    else:
        row.proficiency_level = proficiency_level
    db.flush()


def upsert_program(db: Session, *, name: str, provider: str, duration: str, difficulty: Difficulty,
                   description: str, skills: list[tuple[Skill, int]]) -> TrainingProgram:
    program = db.scalar(select(TrainingProgram).where(TrainingProgram.name == name))
    if program is None:
        program = TrainingProgram(name=name, provider=provider, duration=duration,
                                  difficulty=difficulty, description=description)
        db.add(program)
        db.flush()
    have = {ps.skill_id for ps in program.skills}
    for skill, level in skills:
        if skill.id not in have:
            program.skills.append(ProgramSkill(skill_id=skill.id, target_level=level))
    db.flush()
    return program


def ensure_employment(db: Session, profile: Trainee, *, company: str, role: str, location: str, start: date,
                      end: date | None, skills_used: list[str], verified: bool, **links) -> Employment:
    row = db.scalar(select(Employment).where(
        Employment.trainee_id == profile.id, Employment.company_name == company, Employment.joining_date == start
    ))
    if row is None:
        row = Employment(trainee_id=profile.id, company_name=company, role_title=role, location=location,
                         joining_date=start, end_date=end, skills_used=skills_used,
                         employment_type=EmploymentType.FULL_TIME,
                         verification_status=VerificationStatus.VERIFIED if verified else VerificationStatus.UNVERIFIED,
                         **links)
        db.add(row)
        db.flush()
    return row


# ---------------------------------------------------------------------------
# demo data definitions
# ---------------------------------------------------------------------------

# name, description, DEMO market demand (0-100), DEMO trend
SKILLS = [
    ("Python", "General-purpose programming language", 91, SkillTrend.RISING),
    ("Java", "Enterprise programming language", 78, SkillTrend.STABLE),
    ("JavaScript", "Web scripting language", 85, SkillTrend.STABLE),
    ("C++", "Systems programming language", 60, SkillTrend.STABLE),
    ("SQL", "Relational database querying", 88, SkillTrend.STABLE),
    ("React", "Frontend UI library", 82, SkillTrend.RISING),
    ("Node.js", "JavaScript server runtime", 74, SkillTrend.STABLE),
    ("FastAPI", "Python web framework for APIs", 66, SkillTrend.RISING),
    ("Machine Learning", "Building predictive models", 87, SkillTrend.RISING),
    ("Data Analysis", "Extracting insights from data", 84, SkillTrend.RISING),
    ("AWS", "Amazon Web Services cloud platform", 86, SkillTrend.RISING),
    ("Docker", "Containerization tool", 79, SkillTrend.RISING),
    ("Ruby", "Dynamic programming language (Rails)", 45, SkillTrend.DECLINING),
    ("PostgreSQL", "Open-source relational database", 72, SkillTrend.RISING),
    ("Git", "Version control", 70, SkillTrend.STABLE),
    ("Communication", "Verbal and written communication", 80, SkillTrend.STABLE),
    ("Excel", "Spreadsheets and reporting", 65, SkillTrend.DECLINING),
    ("Tally", "Accounting software", 50, SkillTrend.STABLE),
    ("Electrical Wiring", "Domestic and industrial wiring", 58, SkillTrend.STABLE),
    ("Welding", "Arc and gas welding", 55, SkillTrend.STABLE),
]

# state -> districts (DEMO geography for location analytics)
GEO = {
    "Karnataka": ["Bengaluru Urban", "Mysuru", "Dharwad"],
    "Maharashtra": ["Pune", "Mumbai Suburban", "Nagpur"],
    "Kerala": ["Ernakulam", "Thiruvananthapuram"],
    "Uttar Pradesh": ["Lucknow", "Kanpur Nagar", "Varanasi"],
    "Tamil Nadu": ["Chennai", "Coimbatore"],
    "Bihar": ["Patna", "Gaya"],
    "Rajasthan": ["Jaipur", "Jodhpur"],
}
# per-state employment probability so the demo dashboard shows variation
EMPLOYMENT_P = {"Karnataka": 0.65, "Maharashtra": 0.6, "Kerala": 0.55, "Tamil Nadu": 0.5,
                "Uttar Pradesh": 0.35, "Rajasthan": 0.3, "Bihar": 0.25}
FIRST = ["Aarav", "Diya", "Kabir", "Ananya", "Rohan", "Isha", "Vikram", "Meera", "Arjun", "Sneha",
         "Karan", "Pooja", "Nikhil", "Riya", "Siddharth", "Neha", "Manish", "Kavya", "Aditya", "Tanvi"]
LAST = ["Patel", "Reddy", "Singh", "Iyer", "Gupta", "Das", "Khan", "Joshi", "Menon", "Yadav"]
EDUCATION = ["10th Pass", "12th Pass", "ITI Electrician", "Diploma in Mechanical", "B.Sc Computer Science",
             "B.Com", "B.Tech Information Technology", "BCA", "MCA", "M.Sc Statistics"]


# ---------------------------------------------------------------------------
# seed
# ---------------------------------------------------------------------------

def run() -> None:
    db = SessionLocal()
    rng = random.Random(26135)  # deterministic demo data
    try:
        admin = ensure_admin(db)

        # --- original demo accounts ----------------------------------------
        emp1_user, _ = get_or_create_user(db, email=f"employer1@{DEMO_DOMAIN}", name="TechNova HR", role=UserRole.EMPLOYER)
        employer1 = ensure_employer_profile(db, emp1_user, company_name="TechNova Solutions", location="Bengaluru")
        emp2_user, _ = get_or_create_user(db, email=f"employer2@{DEMO_DOMAIN}", name="DataWorks HR", role=UserRole.EMPLOYER)
        employer2 = ensure_employer_profile(db, emp2_user, company_name="DataWorks Analytics", location="Pune")

        tr1_user, _ = get_or_create_user(db, email=f"trainee1@{DEMO_DOMAIN}", name="Ayaan Sharma", role=UserRole.TRAINEE)
        trainee1 = ensure_profile(db, tr1_user, state="Karnataka", district="Bengaluru Urban",
                                  education="B.Tech Computer Science", phone="9876500001", employed=True)
        tr2_user, _ = get_or_create_user(db, email=f"trainee2@{DEMO_DOMAIN}", name="Priya Verma", role=UserRole.TRAINEE)
        trainee2 = ensure_profile(db, tr2_user, state="Maharashtra", district="Pune",
                                  education="B.Sc Statistics", phone="9876500002")
        tr3_user, _ = get_or_create_user(db, email=f"trainee3@{DEMO_DOMAIN}", name="Rahul Nair", role=UserRole.TRAINEE)
        trainee3 = ensure_profile(db, tr3_user, state="Kerala", district="Ernakulam",
                                  education="MCA", phone="9876500003")
        db.commit()

        # --- skills (with DEMO market data) ----------------------------------
        skills = {name: upsert_skill(db, name=name, description=desc, demand=d, trend=t) for name, desc, d, t in SKILLS}
        db.commit()

        # --- job roles + jobs --------------------------------------------------
        roles = {t: get_or_create_job_role(db, title=t, description=d) for t, d in [
            ("Backend Developer", "Server-side APIs and services"),
            ("Frontend Developer", "Client-side web interfaces"),
            ("Data Analyst", "Business data insights"),
            ("Data Scientist", "ML-driven products"),
            ("Cloud Engineer", "Cloud infrastructure and DevOps"),
            ("Accounts Assistant", "Bookkeeping and accounts"),
            ("Electrician", "Electrical installation and maintenance"),
        ]}
        jobs = {
            "backend": upsert_job(db, employer=employer1, job_role=roles["Backend Developer"],
                                  title="Backend Developer - Python APIs", location="Bengaluru",
                                  salary_min=600000, salary_max=900000, min_exp=0, min_edu=3,
                                  description="Build and maintain FastAPI services backed by PostgreSQL."),
            "frontend": upsert_job(db, employer=employer1, job_role=roles["Frontend Developer"],
                                   title="Frontend Developer - React", location="Bengaluru",
                                   salary_min=500000, salary_max=800000, min_exp=0, min_edu=2,
                                   description="Build React interfaces for internal tools."),
            "analyst": upsert_job(db, employer=employer2, job_role=roles["Data Analyst"],
                                  title="Data Analyst - Business Insights", location="Pune",
                                  salary_min=500000, salary_max=750000, min_exp=0, min_edu=3,
                                  description="Turn raw data into dashboards and reports using SQL and Python."),
            "scientist": upsert_job(db, employer=employer2, job_role=roles["Data Scientist"],
                                    title="Data Scientist - ML Products", location="Pune",
                                    salary_min=800000, salary_max=1200000, min_exp=2, min_edu=4,
                                    description="Design and ship machine learning models for production use."),
            "cloud": upsert_job(db, employer=employer1, job_role=roles["Cloud Engineer"],
                                title="Cloud Engineer - AWS", location="Bengaluru",
                                salary_min=700000, salary_max=1100000, min_exp=2, min_edu=3,
                                description="Operate AWS infrastructure, Docker deployments and CI/CD pipelines."),
            "node": upsert_job(db, employer=employer2, job_role=roles["Backend Developer"],
                               title="Node.js Developer", location="Pune",
                               salary_min=550000, salary_max=850000, min_exp=1, min_edu=3,
                               description="Build Node.js REST services with PostgreSQL."),
            "accounts": upsert_job(db, employer=employer2, job_role=roles["Accounts Assistant"],
                                   title="Accounts Assistant", location="Pune",
                                   salary_min=250000, salary_max=350000, min_exp=0, min_edu=2,
                                   description="Maintain ledgers in Tally and prepare Excel reports."),
            "electrician": upsert_job(db, employer=employer1, job_role=roles["Electrician"],
                                      title="Electrician - Facilities", location="Bengaluru",
                                      salary_min=220000, salary_max=320000, min_exp=1, min_edu=2,
                                      description="Maintain electrical wiring and panels across office campuses."),
        }
        db.commit()

        requirements = [
            ("backend", "Python", 4, True), ("backend", "SQL", 3, True), ("backend", "FastAPI", 3, True),
            ("backend", "Docker", 2, False), ("backend", "Git", 2, False),
            ("frontend", "JavaScript", 4, True), ("frontend", "React", 4, True), ("frontend", "Git", 2, True),
            ("frontend", "Communication", 2, False),
            ("analyst", "SQL", 4, True), ("analyst", "Data Analysis", 4, True), ("analyst", "Communication", 3, True),
            ("analyst", "Python", 2, False),
            ("scientist", "Python", 4, True), ("scientist", "Machine Learning", 4, True), ("scientist", "SQL", 3, True),
            ("scientist", "Data Analysis", 3, False),
            ("cloud", "AWS", 4, True), ("cloud", "Docker", 3, True), ("cloud", "Python", 2, False), ("cloud", "Git", 3, True),
            ("node", "Node.js", 4, True), ("node", "JavaScript", 4, True), ("node", "PostgreSQL", 3, True),
            ("accounts", "Tally", 3, True), ("accounts", "Excel", 3, True), ("accounts", "Communication", 2, False),
            ("electrician", "Electrical Wiring", 4, True), ("electrician", "Communication", 2, False),
        ]
        for key, skill_name, level, required in requirements:
            upsert_job_requirement(db, job=jobs[key], skill=skills[skill_name], required_level=level, required=required)
        db.commit()

        # --- original trainee skills -------------------------------------------
        for trainee, pairs in [
            (trainee1, [("Python", 4), ("SQL", 3), ("FastAPI", 3), ("Git", 3), ("Docker", 2)]),
            (trainee2, [("SQL", 4), ("Data Analysis", 4), ("Communication", 3), ("Python", 2)]),
            (trainee3, [("JavaScript", 3), ("React", 2), ("Git", 2)]),
        ]:
            for skill_name, level in pairs:
                upsert_trainee_skill(db, trainee=trainee, skill=skills[skill_name], proficiency_level=level)
        db.commit()

        # --- trainee1 -> SELECTED application -> Employment ------------------
        application = db.scalar(select(JobApplication).where(
            JobApplication.job_id == jobs["backend"].id, JobApplication.trainee_id == trainee1.id))
        if application is None:
            application = JobApplication(job_id=jobs["backend"].id, trainee_id=trainee1.id)
            db.add(application)
        application.status = ApplicationStatus.SELECTED
        existing = db.scalar(select(Employment).where(
            Employment.job_id == jobs["backend"].id, Employment.trainee_id == trainee1.id))
        if existing is None:
            ensure_employment(db, trainee1, company="TechNova Solutions", role="Backend Developer",
                              location="Bengaluru", start=date.today() - timedelta(days=30), end=None,
                              skills_used=["Python", "FastAPI", "SQL"], verified=True,
                              employer_id=employer1.id, job_role_id=roles["Backend Developer"].id,
                              job_id=jobs["backend"].id, salary=750000)
        db.commit()

        # --- training programs / courses -------------------------------------
        programs = [
            ("Python Programming Foundations", "Skill India Digital", "6 weeks", Difficulty.BEGINNER,
             "Python syntax, data structures and scripting.", [("Python", 3), ("Git", 2)]),
            ("Full-Stack Web with React", "NASSCOM FutureSkills", "10 weeks", Difficulty.INTERMEDIATE,
             "JavaScript, React and REST integration.", [("JavaScript", 4), ("React", 4), ("Git", 3)]),
            ("Data Analytics with SQL & Python", "NIELIT", "8 weeks", Difficulty.INTERMEDIATE,
             "SQL, pandas and dashboarding.", [("SQL", 4), ("Data Analysis", 4), ("Python", 3)]),
            ("Applied Machine Learning", "IIT Madras Pravartak", "12 weeks", Difficulty.ADVANCED,
             "Supervised learning, model evaluation and deployment.", [("Machine Learning", 4), ("Python", 4)]),
            ("Cloud & DevOps on AWS", "AWS re/Start", "12 weeks", Difficulty.INTERMEDIATE,
             "AWS core services, Docker and CI/CD.", [("AWS", 4), ("Docker", 3), ("Git", 3)]),
            ("Backend APIs with FastAPI", "Skill India Digital", "6 weeks", Difficulty.INTERMEDIATE,
             "FastAPI, PostgreSQL and testing.", [("FastAPI", 4), ("PostgreSQL", 3), ("Python", 4)]),
            ("Workplace Communication", "NSDC", "3 weeks", Difficulty.BEGINNER,
             "Professional communication and email writing.", [("Communication", 3)]),
            ("Tally & Excel for Accounts", "NSDC", "4 weeks", Difficulty.BEGINNER,
             "Tally Prime and Excel reporting.", [("Tally", 3), ("Excel", 3)]),
        ]
        for name, provider, duration, diff, desc, pskills in programs:
            upsert_program(db, name=name, provider=provider, duration=duration, difficulty=diff, description=desc,
                           skills=[(skills[s], lvl) for s, lvl in pskills])
        db.commit()

        # --- generated DEMO trainees across states -------------------------------
        skill_names = [s[0] for s in SKILLS]
        states = list(GEO)
        for i in range(1, 41):
            state = states[(i - 1) % len(states)]
            district = rng.choice(GEO[state])
            name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
            user, _ = get_or_create_user(db, email=f"demo.trainee{i:02d}@{DEMO_DOMAIN}", name=name, role=UserRole.TRAINEE)
            employed = rng.random() < EMPLOYMENT_P[state]
            profile = ensure_profile(db, user, state=state, district=district, education=rng.choice(EDUCATION),
                                     phone=f"90000{i:05d}", employed=employed)
            for skill_name in rng.sample(skill_names, rng.randint(2, 5)):
                upsert_trainee_skill(db, trainee=profile, skill=skills[skill_name], proficiency_level=rng.randint(1, 4))
        db.commit()

        # --- DEMO employees with employment history ----------------------------
        employees = [
            ("employee1", "Sanya Kapoor", "Karnataka", "Bengaluru Urban", "B.Tech Computer Science",
             [("Infosys", "Associate Engineer", "Mysuru", 1600, 900, ["Java", "SQL"]),
              ("TechNova Solutions", "Software Engineer", "Bengaluru", 880, None, ["Python", "AWS", "Docker"])],
             [("Python", 4), ("Java", 3), ("SQL", 3), ("AWS", 3), ("Docker", 3), ("Git", 3)]),
            ("employee2", "Imran Qureshi", "Maharashtra", "Pune", "BCA",
             [("DataWorks Analytics", "Junior Analyst", "Pune", 1200, None, ["SQL", "Excel", "Data Analysis"])],
             [("SQL", 4), ("Excel", 4), ("Data Analysis", 3), ("Communication", 3)]),
            ("employee3", "Lakshmi Pillai", "Kerala", "Thiruvananthapuram", "ITI Electrician",
             [("KSEB Contractor", "Apprentice Electrician", "Kollam", 2200, 1500, ["Electrical Wiring"]),
              ("Lulu Facilities", "Electrician", "Thiruvananthapuram", 1450, None, ["Electrical Wiring"])],
             [("Electrical Wiring", 4), ("Communication", 2)]),
        ]
        for key, name, state, district, edu, history, eskills in employees:
            user, _ = get_or_create_user(db, email=f"{key}@{DEMO_DOMAIN}", name=name, role=UserRole.EMPLOYEE)
            profile = ensure_profile(db, user, state=state, district=district, education=edu,
                                     phone=f"98000{len(key):05d}", employed=True, employee=True)
            for company, role, loc, start_ago, end_ago, used in history:
                ensure_employment(db, profile, company=company, role=role, location=loc,
                                  start=date(2026, 9, 1) - timedelta(days=start_ago),
                                  end=None if end_ago is None else date(2026, 9, 1) - timedelta(days=end_ago),
                                  skills_used=used, verified=end_ago is not None)
            for skill_name, level in eskills:
                upsert_trainee_skill(db, trainee=profile, skill=skills[skill_name], proficiency_level=level)
        db.commit()

        # --- DEMO announcements ------------------------------------------------
        for title, message, audience in [
            ("[DEMO] Welcome to SkillBridge", "Complete your profile and add your skills to get job matches.", Audience.ALL),
            ("[DEMO] New AWS cohort", "Enrollments for 'Cloud & DevOps on AWS' are open.", Audience.TRAINEES),
            ("[DEMO] Upload employment proof", "Upload your offer or experience letter to verify your skills.", Audience.EMPLOYEES),
        ]:
            if db.scalar(select(Announcement).where(Announcement.title == title)) is None:
                db.add(Announcement(title=title, message=message, target_audience=audience,
                                    created_by=admin.id if admin else None))
        db.commit()

        # --- summary ---------------------------------------------------------
        print("Seed complete (all records below are DEMO data).\n")
        if admin:
            print(f"ADMIN     {settings.admin_email}  (password: ADMIN_PASSWORD in backend/.env)")
        print(f"Demo password for all other demo accounts: {DEMO_PASSWORD}")
        print(f"  TRAINEE   trainee1..3@{DEMO_DOMAIN}, demo.trainee01..40@{DEMO_DOMAIN}")
        print(f"  EMPLOYEE  employee1..3@{DEMO_DOMAIN}")
        print(f"  EMPLOYER  employer1..2@{DEMO_DOMAIN}  (legacy role)")
    finally:
        db.close()


if __name__ == "__main__":
    run()
