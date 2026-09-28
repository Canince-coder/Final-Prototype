from datetime import date, timedelta
from types import SimpleNamespace as NS

from app.services.assessment import analyze_resume, assess_project
from app.services.skills import education_level, experience_months


def test_experience_merges_overlaps_and_ignores_future():
    d = date.today()
    jobs = [
        NS(joining_date=d - timedelta(days=730), end_date=d - timedelta(days=365)),
        NS(joining_date=d - timedelta(days=500), end_date=d - timedelta(days=100)),  # overlaps the first
        NS(joining_date=d + timedelta(days=10), end_date=None),  # future: not counted
    ]
    assert experience_months(jobs) == round(630 / 30.44)
    assert experience_months([]) == 0


def test_education_level():
    assert education_level("PhD Physics") == 5
    assert education_level("MCA") == 4
    assert education_level("B.Tech Computer Science") == 3
    assert education_level("ITI Electrician") == 2
    assert education_level("10th Pass") == 1
    assert education_level("Not specified") == 0


def test_assessment_is_deterministic_and_bounded():
    kwargs = dict(title="t", description="word " * 50, technologies=[], repository_url=None, detected_skills=[])
    a, b = assess_project(**kwargs), assess_project(**kwargs)
    assert a == b and 1 <= a["overall_score"] <= 5


def test_ats_full_coverage_scores_high():
    text = ("Summary Experience Education Skills Projects Certifications a@b.com +91 98765 43210 Python SQL "
            + "delivered 30% faster reports " * 60)
    r = analyze_resume(resume_text=text, target_role="Python developer", job_description="Python SQL",
                       resume_skills=["Python", "SQL"], job_skills=["Python", "SQL"])
    assert r["ats_score"] >= 90 and r["missing_skills"] == []
