"""Rule-based skill utilities shared by projects, resumes, submissions and matching.

No ML model is involved: skills are detected by matching the platform's skill
vocabulary (the `skills` table) plus a small alias list against free text.
"""
import re
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import SkillSource, VerificationStatus
from app.models.skill import Skill, TraineeSkill
from app.models.trainee import Trainee

# alias (lowercase) -> canonical skill name as stored in the skills table
ALIASES = {
    "js": "JavaScript", "reactjs": "React", "react.js": "React", "nodejs": "Node.js", "node js": "Node.js",
    "postgres": "PostgreSQL", "postgresql": "PostgreSQL", "ml": "Machine Learning", "amazon web services": "AWS",
    "cpp": "C++", "golang": "Go", "k8s": "Kubernetes", "ror": "Ruby", "rails": "Ruby",
    "data analytics": "Data Analysis", "pandas": "Data Analysis", "scikit-learn": "Machine Learning",
    "tensorflow": "Machine Learning", "pytorch": "Machine Learning", "mysql": "SQL", "github": "Git",
}


def _term_regex(term: str) -> re.Pattern:
    # word boundaries that also work for names like "C++", "Node.js", "C#"
    return re.compile(r"(?<![\w+#.])" + re.escape(term.lower()) + r"(?![\w+#])")


def extract_skills(db: Session, *texts: str | None) -> list[str]:
    """Return canonical skill names (from the skills table) mentioned in the texts."""
    text = " ".join(t for t in texts if t).lower()
    if not text:
        return []
    known = {name.lower(): name for name in db.scalars(select(Skill.name))}
    found = {name for low, name in known.items() if _term_regex(low).search(text)}
    for alias, canonical in ALIASES.items():
        if canonical.lower() in known and _term_regex(alias).search(text):
            found.add(known[canonical.lower()])
    return sorted(found)


def apply_detected_skills(
    db: Session,
    profile: Trainee,
    skill_names: list[str],
    *,
    source: SkillSource,
    level: int,
    competency: float | None = None,
    verification: VerificationStatus = VerificationStatus.UNVERIFIED,
) -> list[str]:
    """Add missing skills to a profile, or raise level/competency of existing ones.

    Never lowers an existing level or competency. Returns the names touched.
    Caller commits.
    """
    if not skill_names:
        return []
    level = max(1, min(5, level))
    skills = db.scalars(select(Skill).where(Skill.name.in_(skill_names))).all()
    current = {
        ts.skill_id: ts
        for ts in db.scalars(select(TraineeSkill).where(TraineeSkill.trainee_id == profile.id))
    }
    touched = []
    for skill in skills:
        row = current.get(skill.id)
        if row is None:
            db.add(TraineeSkill(
                trainee_id=profile.id, skill_id=skill.id, proficiency_level=level,
                competency_score=competency, source=source, verification_status=verification,
            ))
        else:
            row.proficiency_level = max(row.proficiency_level, level)
            if competency is not None:
                row.competency_score = max(row.competency_score or 0, competency)
            if verification == VerificationStatus.VERIFIED:
                row.verification_status = VerificationStatus.VERIFIED
        touched.append(skill.name)
    return touched


_EDU_LEVELS = [
    (5, r"ph\.?d|doctor"),
    (4, r"m\.?tech|m\.?sc|mca|mba|m\.?com|m\.?e\b|m\.?a\b|master|post ?grad|\bpg\b"),
    (3, r"b\.?tech|b\.?e\b|b\.?sc|bca|b\.?com|b\.?a\b|bachelor|graduat|degree"),
    (2, r"12th|hsc|diploma|\biti\b|intermediate|puc|higher secondary"),
    (1, r"10th|ssc|matric|secondary"),
]


def education_level(education: str | None) -> int:
    """Map free-text education to 0-5 (0 none/unknown ... 5 doctorate)."""
    text = (education or "").lower()
    for level, pattern in _EDU_LEVELS:
        if re.search(pattern, text):
            return level
    return 0


def experience_months(employments) -> int:
    """Total months worked, with overlapping jobs counted once."""
    spans = sorted((e.joining_date, e.end_date or date.today()) for e in employments if e.joining_date)
    total_days, cur_start, cur_end = 0, None, None
    for start, end in spans:
        if start > date.today():
            continue  # future joining date: not experience yet
        end = min(end, date.today())
        if cur_end is None or start > cur_end:
            if cur_end is not None:
                total_days += (cur_end - cur_start).days
            cur_start, cur_end = start, end
        else:
            cur_end = max(cur_end, end)
    if cur_end is not None:
        total_days += (cur_end - cur_start).days
    return max(0, round(total_days / 30.44))
