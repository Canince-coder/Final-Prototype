"""Project competency assessment and resume/ATS analysis.

HONESTY NOTE: there is no AI/ML model in this project. Both functions below are
transparent rule-based heuristics (keyword cues + counts). Every result carries
`engine` and `ai_model: None` so clients never mistake it for model output.

To plug in a real model later, replace the body of `assess_project` /
`analyze_resume` and keep the returned dict shape; callers don't change.
"""
import re
from collections import Counter

ENGINE = "rule-based-v1"
DISCLAIMER = "Heuristic score from keyword/structure rules; not produced by an AI model."


def _scale(hits: int, thresholds: tuple[int, int, int, int]) -> int:
    """Map a count onto 1-5 using ascending thresholds for scores 2,3,4,5."""
    return 1 + sum(hits >= t for t in thresholds)


def _count_cues(text: str, cues: list[str]) -> int:
    return sum(1 for cue in cues if cue in text)


_COMPLEXITY_CUES = [
    "authentication", "authorization", "jwt", "oauth", "database", "api", "rest", "graphql", "real-time",
    "websocket", "machine learning", "model", "deploy", "docker", "kubernetes", "microservice", "cache",
    "redis", "scal", "concurren", "distributed", "security", "encrypt", "payment", "cloud", "aws",
    "ci/cd", "pipeline", "queue", "search", "recommendation",
]
_PROBLEM_CUES = [
    "problem", "solve", "challenge", "improv", "reduc", "optimi", "automat", "users", "so that",
    "because", "instead of", "manual", "faster", "efficien", "%", "impact",
]
_QUALITY_CUES = [
    "test", "pytest", "jest", "unit", "github actions", "documentation", "readme", "architecture", "modular",
    "error handling", "validation", "logging", "lint", "type hint", "code review", "refactor",
]
_COMPLETE_CUES = ["deployed", "completed", "production", "live", "released", "demo", "hosted", "users"]

_DIMENSION_TEXT = {
    "technical_complexity": ("Technically ambitious scope", "Scope is technically simple",
                             "Add a harder component: auth, a database layer, an external API or deployment."),
    "problem_solving": ("Clearly framed problem and outcome", "Problem being solved is not clearly stated",
                        "State the problem, who it helps and the measurable result (e.g. time saved)."),
    "implementation_quality": ("Evidence of engineering practice (tests/docs/structure)",
                               "Little evidence of testing, documentation or structure",
                               "Add tests, a README and a public repository link."),
    "technology_usage": ("Uses a relevant, varied tech stack", "Very few technologies listed",
                         "List the languages, frameworks and tools you actually used."),
    "project_completeness": ("Described in detail and appears finished", "Description is short or project looks unfinished",
                             "Describe features, current status and whether it is deployed/demoable."),
}


def assess_project(
    *, title: str, description: str, technologies: list[str], repository_url: str | None, detected_skills: list[str]
) -> dict:
    """Score a project 1-5 on five dimensions. Rule-based (see module docstring)."""
    text = f"{title} {description} {' '.join(technologies)}".lower()
    words = len(description.split())
    stack = {t.strip().lower() for t in technologies if t.strip()} | {s.lower() for s in detected_skills}

    scores = {
        "technical_complexity": _scale(_count_cues(text, _COMPLEXITY_CUES), (1, 2, 4, 6)),
        "problem_solving": _scale(_count_cues(text, _PROBLEM_CUES), (1, 2, 3, 5)),
        "implementation_quality": _scale(
            _count_cues(text, _QUALITY_CUES) + (2 if repository_url else 0), (1, 2, 4, 5)
        ),
        "technology_usage": _scale(len(stack), (1, 2, 3, 5)),
        "project_completeness": round(
            (_scale(words, (30, 60, 120, 200)) + _scale(_count_cues(text, _COMPLETE_CUES), (1, 1, 2, 3))) / 2
        ),
    }
    overall = round(sum(scores.values()) / len(scores), 1)
    return {
        "overall_score": overall,
        **scores,
        "detected_skills": detected_skills,
        "strengths": [_DIMENSION_TEXT[k][0] for k, v in scores.items() if v >= 4],
        "weaknesses": [_DIMENSION_TEXT[k][1] for k, v in scores.items() if v <= 2],
        "recommendations": [_DIMENSION_TEXT[k][2] for k, v in scores.items() if v <= 3],
        "engine": ENGINE,
        "ai_model": None,
        "disclaimer": DISCLAIMER,
    }


_STOPWORDS = set(
    "the and for with that this from your will have are you our work team role able must should into about "
    "using such other more than their they them also well strong good experience years year skills skill "
    "knowledge ability required requirements responsibilities preferred plus including within across job "
    "candidate looking join help build we who what when where which while would could can may".split()
)
_SECTIONS = {
    "summary": r"summary|objective|profile",
    "experience": r"experience|employment|work history|internship",
    "education": r"education|qualification|academic",
    "skills": r"skills|technical skills|competencies",
    "projects": r"projects?",
    "certifications": r"certification|certificate|courses?",
}
_PROJECT_IDEAS = {
    "Python": "Build a REST API with FastAPI and PostgreSQL, with tests and Docker",
    "SQL": "Design a normalized database and write analytical SQL reports on a public dataset",
    "JavaScript": "Build an interactive single-page web app with vanilla JavaScript",
    "React": "Build a React dashboard that consumes a public API with routing and state management",
    "Node.js": "Build an Express/Node.js REST API with authentication",
    "Machine Learning": "Train and deploy a classification model with a small web demo",
    "Data Analysis": "Analyse a public dataset in pandas and publish a dashboard of insights",
    "AWS": "Deploy a web app on AWS (EC2/S3/RDS) with infrastructure notes",
    "Docker": "Containerize a multi-service app with docker-compose",
    "Java": "Build a Spring Boot CRUD service with unit tests",
    "Ruby": "Build a Ruby on Rails app with authentication and a database",
    "FastAPI": "Build a FastAPI service with JWT auth and background tasks",
}


def _keywords(text: str, limit: int = 15) -> list[str]:
    tokens = re.findall(r"[a-zA-Z][a-zA-Z+#.]{2,}", text.lower())
    counts = Counter(t.strip(".") for t in tokens if t not in _STOPWORDS and len(t) > 3)
    return [w for w, _ in counts.most_common(limit)]


def analyze_resume(
    *,
    resume_text: str,
    target_role: str,
    job_description: str,
    resume_skills: list[str],
    job_skills: list[str],
) -> dict:
    """ATS-style resume analysis. Rule-based (see module docstring)."""
    text = resume_text.lower()
    words = len(resume_text.split())

    missing_skills = [s for s in job_skills if s not in resume_skills]
    skill_cov = 1.0 if not job_skills else (len(job_skills) - len(missing_skills)) / len(job_skills)

    keywords = _keywords(f"{target_role} {job_description}")
    missing_keywords = [k for k in keywords if k not in text]
    kw_cov = 1.0 if not keywords else (len(keywords) - len(missing_keywords)) / len(keywords)

    sections = {name: bool(re.search(p, text)) for name, p in _SECTIONS.items()}
    section_cov = sum(sections.values()) / len(sections)

    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", resume_text))
    has_phone = bool(re.search(r"(\+?\d[\d\s-]{8,}\d)", resume_text))
    good_length = 250 <= words <= 1200
    fmt = (has_email + has_phone + good_length) / 3

    ats = round(100 * (0.5 * skill_cov + 0.2 * kw_cov + 0.2 * section_cov + 0.1 * fmt))

    strengths, weaknesses, suggestions = [], [], []
    if skill_cov >= 0.7:
        strengths.append(f"Covers {len(job_skills) - len(missing_skills)}/{len(job_skills)} skills the role asks for")
    elif job_skills:
        weaknesses.append(f"Only {len(job_skills) - len(missing_skills)}/{len(job_skills)} required skills appear")
        suggestions.append("Add the missing skills you genuinely have to a Skills section, with evidence in projects/experience")
    for name, present in sections.items():
        (strengths if present else weaknesses).append(
            f"Has a {name} section" if present else f"No {name} section detected"
        )
        if not present and name in ("experience", "skills", "projects", "education"):
            suggestions.append(f"Add a clearly titled '{name.title()}' section")
    if not has_email or not has_phone:
        weaknesses.append("Contact details incomplete")
        suggestions.append("Include an email address and phone number at the top")
    if words < 250:
        weaknesses.append(f"Resume is short ({words} words)")
        suggestions.append("Expand bullet points with concrete achievements and numbers")
    elif words > 1200:
        weaknesses.append(f"Resume is long ({words} words)")
        suggestions.append("Trim to the most relevant 1-2 pages")
    if missing_keywords:
        suggestions.append("Mirror relevant job-description terms where accurate: " + ", ".join(missing_keywords[:5]))
    if not re.search(r"\d+%|\d+\+|\b\d{2,}\b", resume_text):
        suggestions.append("Quantify impact (e.g. 'reduced load time by 30%')")

    return {
        "ats_score": ats,
        "target_role": target_role,
        "matched_skills": [s for s in job_skills if s in resume_skills],
        "missing_skills": missing_skills,
        "missing_keywords": missing_keywords,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "suggestions": suggestions,
        "recommended_skills": missing_skills[:8],
        "recommended_projects": [
            _PROJECT_IDEAS.get(s, f"Build a small portfolio project that uses {s} end-to-end")
            for s in missing_skills[:3]
        ],
        "score_breakdown": {
            "skill_coverage": round(skill_cov * 100),
            "keyword_coverage": round(kw_cov * 100),
            "section_coverage": round(section_cov * 100),
            "formatting": round(fmt * 100),
        },
        "engine": ENGINE,
        "ai_model": None,
        "disclaimer": DISCLAIMER,
    }
