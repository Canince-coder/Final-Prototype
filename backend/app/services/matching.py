import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import CourseStatus
from app.models.job import Job, JobRequirement
from app.models.skill import TraineeSkill
from app.models.training import ProgramSkill, TrainingEnrollment, TrainingProgram


@dataclass
class SkillMatch:
    skill_id: uuid.UUID
    skill_name: str
    required_level: int
    candidate_level: int
    gap: int
    required: bool
    score: float


@dataclass
class MatchResult:
    match_percentage: float
    per_skill: list[SkillMatch]

    @property
    def strengths(self) -> list[SkillMatch]:
        return [s for s in self.per_skill if s.gap == 0]

    @property
    def gaps(self) -> list[SkillMatch]:
        return sorted(
            (s for s in self.per_skill if s.gap > 0),
            key=lambda s: (-s.gap, s.skill_name),
        )


def load_trainee_skill_levels(db: Session, trainee_id: uuid.UUID) -> dict[uuid.UUID, int]:
    rows = db.execute(
        select(TraineeSkill.skill_id, TraineeSkill.proficiency_level).where(
            TraineeSkill.trainee_id == trainee_id
        )
    ).all()
    return {skill_id: int(level) for skill_id, level in rows}


def compute_match(
    skill_levels: dict[uuid.UUID, int],
    requirements,
) -> MatchResult:
    """Transparent scoring per the brief.

    For each job requirement:
        score = min(candidate_level / required_level, 1)
        gap   = max(0, required_level - candidate_level)
    match_percentage = average(score) * 100  (0.0 when the job has no requirements)
    A skill the trainee does not have counts as candidate_level 0.
    """
    per_skill: list[SkillMatch] = []
    total = 0.0
    for rq in requirements:
        candidate = int(skill_levels.get(rq.skill_id, 0))
        required_level = int(rq.required_level)
        score = min(candidate / required_level, 1.0) if required_level > 0 else 1.0
        total += score
        gap = max(0, required_level - candidate)
        per_skill.append(
            SkillMatch(
                skill_id=rq.skill_id,
                skill_name=rq.skill.name if rq.skill is not None else "",
                required_level=required_level,
                candidate_level=candidate,
                gap=gap,
                required=bool(rq.required),
                score=score,
            )
        )
    match_percentage = (total / len(per_skill) * 100.0) if per_skill else 0.0
    return MatchResult(match_percentage=match_percentage, per_skill=per_skill)


# ---------------------------------------------------------------------------
# Recommendations (rule-based, built on compute_match)
# ---------------------------------------------------------------------------

def _load_jobs(db: Session) -> list[Job]:
    return db.scalars(
        select(Job).options(
            selectinload(Job.employer),
            selectinload(Job.requirements).selectinload(JobRequirement.skill),
        )
    ).all()


def job_fit(job: Job, levels: dict[uuid.UUID, int]) -> dict:
    """Trainee skills vs required job skills -> matching / missing / match %."""
    result = compute_match(levels, job.requirements)
    return {
        "job_id": job.id,
        "title": job.title,
        "company": job.employer.company_name,
        "location": job.location,
        "required_skills": [s.skill_name for s in result.per_skill],
        "matching_skills": [s.skill_name for s in result.per_skill if s.gap == 0],
        "missing_skills": [s.skill_name for s in result.per_skill if s.candidate_level == 0],
        "skills_to_improve": [s.skill_name for s in result.per_skill if 0 < s.candidate_level < s.required_level],
        "match_percentage": round(result.match_percentage),
        # legacy fields consumed by the current frontend
        "job": job.title,
        "employer": job.employer.company_name,
        "top_skill_gaps": [s.skill_name for s in result.gaps][:3],
    }


def recommend_jobs(db: Session, trainee_id: uuid.UUID, limit: int = 10) -> list[dict]:
    levels = load_trainee_skill_levels(db, trainee_id)
    fits = [job_fit(job, levels) for job in _load_jobs(db)]
    fits.sort(key=lambda f: (-f["match_percentage"], f["title"]))
    return fits[:limit]


# Eligibility weights for employees: skills dominate, experience and education gate.
SKILL_W, EXP_W, EDU_W = 0.6, 0.25, 0.15
ELIGIBLE_AT = 60


def employee_job_eligibility(
    db: Session, trainee_id: uuid.UUID, experience_years: float, edu_level: int, limit: int = 20
) -> list[dict]:
    levels = load_trainee_skill_levels(db, trainee_id)
    out = []
    for job in _load_jobs(db):
        fit = job_fit(job, levels)
        need_exp = float(job.min_experience_years or 0)
        need_edu = int(job.min_education_level or 0)
        exp_score = 1.0 if need_exp <= 0 else min(1.0, experience_years / need_exp)
        edu_score = 1.0 if need_edu <= 0 else min(1.0, edu_level / need_edu)
        eligibility = round(100 * (SKILL_W * fit["match_percentage"] / 100 + EXP_W * exp_score + EDU_W * edu_score))
        fit.update(
            eligibility_score=eligibility,
            eligible=eligibility >= ELIGIBLE_AT,
            experience_required_years=need_exp,
            experience_years=round(experience_years, 1),
            experience_met=exp_score >= 1,
            education_level_required=need_edu,
            education_level=edu_level,
            education_met=edu_score >= 1,
        )
        out.append(fit)
    out.sort(key=lambda f: (-f["eligibility_score"], f["title"]))
    return out[:limit]


def recommend_training(
    db: Session, trainee_id: uuid.UUID, target_job_id: uuid.UUID | None = None, limit: int = 10
) -> dict:
    """Current skills + skill gaps + target job requirements -> ranked programs.

    Target jobs: the given job, else the 3 best-matching jobs that still have gaps.
    A program's relevance = total skill-levels of gap it can close.
    """
    levels = load_trainee_skill_levels(db, trainee_id)
    jobs = _load_jobs(db)
    if target_job_id is not None:
        targets = [j for j in jobs if j.id == target_job_id]
    else:
        by_id = {j.id: j for j in jobs}
        fits = sorted((job_fit(j, levels) for j in jobs), key=lambda f: -f["match_percentage"])
        targets = [by_id[f["job_id"]] for f in fits if f["match_percentage"] < 100][:3]

    gaps: dict[uuid.UUID, tuple[str, int]] = {}  # skill_id -> (name, level needed)
    for job in targets:
        for rq in job.requirements:
            if levels.get(rq.skill_id, 0) < rq.required_level:
                prev = gaps.get(rq.skill_id, ("", 0))[1]
                gaps[rq.skill_id] = (rq.skill.name, max(prev, rq.required_level))

    taken = set(db.scalars(select(TrainingEnrollment.program_id).where(TrainingEnrollment.trainee_id == trainee_id)))
    programs = db.scalars(
        select(TrainingProgram)
        .where(TrainingProgram.status == CourseStatus.ACTIVE)
        .options(selectinload(TrainingProgram.skills).selectinload(ProgramSkill.skill))
    ).all()

    ranked = []
    for program in programs:
        if program.id in taken:
            continue
        addressed, relevance = [], 0
        for ps in program.skills:
            if ps.skill_id in gaps:
                have = levels.get(ps.skill_id, 0)
                closes = min(ps.target_level, gaps[ps.skill_id][1]) - have
                if closes > 0:
                    relevance += closes
                    addressed.append(ps.skill.name)
        if relevance:
            ranked.append({"program": program, "skills_addressed": addressed, "relevance_score": relevance})
    ranked.sort(key=lambda r: (-r["relevance_score"], r["program"].name))
    return {
        "target_jobs": [{"job_id": j.id, "title": j.title} for j in targets],
        "skill_gaps": sorted(name for name, _ in gaps.values()),
        "recommendations": ranked[:limit],
    }
