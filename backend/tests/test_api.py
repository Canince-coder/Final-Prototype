import io
import uuid
import zipfile

from app.core.security import create_access_token


# --- health / swagger / auth ---------------------------------------------------

def test_health_and_swagger(client):
    assert client.get("/health").json() == {"status": "ok", "database": "ok"}
    assert client.get("/docs").status_code == 200
    paths = client.get("/openapi.json").json()["paths"]
    assert "/admin/analytics/employment-by-state" in paths
    # /api alias serves the same routes
    assert client.get("/api/skills").status_code == 401


def test_login_returns_role_for_all_three_roles(client):
    import os

    for email, pw, role in [
        ("trainee1@sih26135-demo.com", "Demo@1234", "TRAINEE"),
        ("employee1@sih26135-demo.com", "Demo@1234", "EMPLOYEE"),
        (os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "ADMIN"),
    ]:
        r = client.post("/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200 and r.json()["role"] == role


def test_login_wrong_password(client):
    r = client.post("/auth/login", json={"email": "trainee1@sih26135-demo.com", "password": "nope"})
    assert r.status_code == 401


def test_bad_tokens_are_401_not_500(client):
    for token in ["garbage", create_access_token("not-a-uuid", "TRAINEE"), create_access_token(str(uuid.uuid4()), "ADMIN")]:
        assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert client.get("/auth/me").status_code == 401


def test_admin_cannot_self_register(client):
    r = client.post("/auth/register", json={"name": "x", "email": "evil@x.com", "password": "12345678", "role": "ADMIN"})
    assert r.status_code == 403


def test_register_employee_gets_uids(client):
    r = client.post("/auth/register", json={
        "name": "New Emp", "email": "newemp@example.com", "password": "Passw0rd!", "role": "EMPLOYEE",
        "state": "Bihar", "district": "Patna",
    })
    assert r.status_code == 201
    tok = client.post("/auth/login", json={"email": "newemp@example.com", "password": "Passw0rd!"}).json()["access_token"]
    me = client.get("/employees/me", headers={"Authorization": f"Bearer {tok}"}).json()
    assert me["employee_uid"].startswith("EMP-") and me["trainee_uid"].startswith("TRN-")
    assert me["employment_status"] == "EMPLOYED"


def test_register_duplicate_and_invalid(client):
    assert client.post("/auth/register", json={"name": "x", "email": "trainee1@sih26135-demo.com",
                                               "password": "12345678"}).status_code == 409
    assert client.post("/auth/register", json={"name": "x", "email": "bad", "password": "1"}).status_code == 422


# --- RBAC ------------------------------------------------------------------------

def test_role_isolation(client, trainee, employee, admin):
    trainee_only = ["/trainees/me", "/trainees/me/dashboard", "/trainees/me/skills", "/trainees/me/training"]
    employee_only = ["/employees/me", "/employees/me/dashboard", "/employees/me/jobs", "/employees/me/submissions"]
    admin_only = ["/admin/dashboard", "/admin/courses", "/admin/skills/analysis", "/analytics/overview"]
    for path in trainee_only:
        assert client.get(path, headers=trainee).status_code == 200, path
        assert client.get(path, headers=employee).status_code == 403, path
        assert client.get(path, headers=admin).status_code == 403, path
    for path in employee_only:
        assert client.get(path, headers=employee).status_code == 200, path
        assert client.get(path, headers=trainee).status_code == 403, path
        assert client.get(path, headers=admin).status_code == 403, path
    for path in admin_only:
        assert client.get(path, headers=admin).status_code == 200, path
        assert client.get(path, headers=trainee).status_code == 403, path
        assert client.get(path, headers=employee).status_code == 403, path


# --- trainee ---------------------------------------------------------------------

def test_trainee_dashboard(client, trainee):
    d = client.get("/trainees/me/dashboard", headers=trainee).json()
    assert d["trainee_uid"].startswith("TRN-")
    for key in ["name", "email", "phone", "location", "education", "current_skills", "competency",
                "employment_status", "training_status", "recommended_jobs", "recommended_training"]:
        assert key in d
    assert d["state"] == "Karnataka" and d["employment_status"] == "EMPLOYED"


def test_recommended_jobs_shape_and_logic(client, trainee, trainee3):
    jobs = client.get("/trainees/me/recommended-jobs", headers=trainee).json()
    top = jobs[0]
    for key in ["job_id", "title", "company", "required_skills", "matching_skills", "missing_skills", "match_percentage",
                "job", "employer", "top_skill_gaps"]:  # new + legacy fields
        assert key in top
    assert top["title"] == "Backend Developer - Python APIs" and top["match_percentage"] == 100
    assert jobs == sorted(jobs, key=lambda j: -j["match_percentage"])
    frontend = next(j for j in client.get("/trainees/me/recommended-jobs", headers=trainee3).json()
                    if j["title"] == "Frontend Developer - React")
    assert "React" in frontend["skills_to_improve"] and "Git" in frontend["matching_skills"]
    assert "Communication" in frontend["missing_skills"] and 0 < frontend["match_percentage"] < 100


def test_my_skills_crud(client, trainee3):
    r = client.post("/trainees/me/skills", headers=trainee3, json={"skill_name": "python", "proficiency_level": 2})
    assert r.status_code == 201, r.text
    row = r.json()
    assert row["skill"]["name"] == "Python" and row["source"] == "SELF_REPORTED"
    assert row["verification_status"] == "UNVERIFIED" and row["competency_score"] is None and row["projects"] == []
    assert client.post("/trainees/me/skills", headers=trainee3,
                       json={"skill_name": "Python", "proficiency_level": 2}).status_code == 409
    assert client.post("/trainees/me/skills", headers=trainee3,
                       json={"skill_name": "Klingon", "proficiency_level": 2}).status_code == 404
    assert client.post("/trainees/me/skills", headers=trainee3, json={"proficiency_level": 2}).status_code == 422
    assert client.post("/trainees/me/skills", headers=trainee3,
                       json={"skill_name": "Java", "proficiency_level": 9}).status_code == 422
    assert client.patch(f"/trainees/me/skills/{row['id']}", headers=trainee3,
                        json={"proficiency_level": 3}).json()["proficiency_level"] == 3
    assert client.delete(f"/trainees/me/skills/{row['id']}", headers=trainee3).status_code == 204


def test_skill_by_id_still_works(client, trainee3):
    skills = client.get("/skills", headers=trainee3).json()
    ruby = next(s for s in skills if s["name"] == "Ruby")
    r = client.post("/trainees/me/skills", headers=trainee3, json={"skill_id": ruby["id"], "proficiency_level": 1})
    assert r.status_code == 201


def test_project_assessment_updates_skills(client, trainee3):
    r = client.post("/trainees/me/projects", headers=trainee3, json={
        "title": "Campus Placement Portal",
        "description": "Built a React and Node.js portal to solve the manual placement process for 2000 users. "
                       "Includes JWT authentication, a PostgreSQL database, REST API, Docker deployment on AWS, "
                       "unit tests with Jest and documentation in the README. Deployed live and used by students.",
        "technologies": ["React", "Node.js", "PostgreSQL", "Docker", "AWS"],
        "repository_url": "https://github.com/example/placement",
    })
    assert r.status_code == 201, r.text
    p = r.json()
    a = p["assessment"]
    assert a["engine"] == "rule-based-v1" and a["ai_model"] is None
    for k in ["technical_complexity", "problem_solving", "implementation_quality", "technology_usage", "project_completeness"]:
        assert 1 <= a[k] <= 5
    assert 1 <= a["overall_score"] <= 5 and a["overall_score"] >= 4
    assert {"React", "Node.js", "PostgreSQL", "Docker", "AWS"} <= set(p["detected_skills"])
    assert "AWS" in p["skills_updated"]
    skills = {s["skill"]["name"]: s for s in client.get("/trainees/me/skills", headers=trainee3).json()}
    assert skills["AWS"]["source"] == "PROJECT_ASSESSMENT" and skills["AWS"]["competency_score"] == a["overall_score"]
    assert skills["AWS"]["projects"][0]["title"] == "Campus Placement Portal"
    assert client.post(f"/trainees/me/projects/{p['id']}/assess", headers=trainee3).status_code == 200
    # weak project scores low
    weak = client.post("/trainees/me/projects", headers=trainee3, json={
        "title": "Calc", "description": "A simple calculator program that adds numbers."}).json()
    assert weak["overall_score"] < 3 and weak["assessment"]["weaknesses"]
    assert client.post("/trainees/me/projects", headers=trainee3, json={"title": "x", "description": "short"}).status_code == 422


def test_training_camp_flow(client, trainee3):
    programs = client.get("/training/programs", headers=trainee3).json()
    assert programs and "skills_covered" in programs[0] and "title" in programs[0]
    rec = client.get("/trainees/me/recommended-training", headers=trainee3).json()
    assert rec["skill_gaps"] and rec["recommendations"]
    first = rec["recommendations"][0]
    assert first["relevance_score"] > 0 and set(first["skills_addressed"]) <= set(rec["skill_gaps"])
    web = next(p for p in programs if p["name"] == "Full-Stack Web with React")
    r = client.post(f"/trainees/me/training/{web['id']}/enroll", headers=trainee3)
    assert r.status_code == 201 and r.json()["status"] == "ENROLLED"
    assert client.post(f"/trainees/me/training/{web['id']}/enroll", headers=trainee3).status_code == 409
    # enrolled programs drop out of recommendations
    rec2 = client.get("/trainees/me/recommended-training", headers=trainee3).json()
    assert web["id"] not in [x["program"]["id"] for x in rec2["recommendations"]]
    done = client.post(f"/trainees/me/training/enrollments/{r.json()['id']}/complete", headers=trainee3)
    assert done.status_code == 200 and done.json()["status"] == "COMPLETED" and "React" in done.json()["skills_updated"]
    assert client.post(f"/trainees/me/training/enrollments/{r.json()['id']}/complete", headers=trainee3).status_code == 400
    history = client.get("/trainees/me/training?status=COMPLETED", headers=trainee3).json()
    assert [h["program"]["name"] for h in history] == ["Full-Stack Web with React"]
    targeted = client.get("/trainees/me/recommended-training",
                          params={"target_job_id": next(j["job_id"] for j in client.get(
                              "/trainees/me/recommended-jobs", headers=trainee3).json() if j["title"] == "Cloud Engineer - AWS")},
                          headers=trainee3).json()
    assert targeted["target_jobs"][0]["title"] == "Cloud Engineer - AWS"


def test_profile_update_and_sensitive_fields(client, trainee):
    r = client.put("/trainees/me", headers=trainee, json={"district": "Mysuru", "state": "Karnataka", "education": None})
    assert r.status_code == 200 and r.json()["district"] == "Mysuru"  # null is ignored, not a 500
    same_phone = client.get("/trainees/me", headers=trainee).json()["phone"]
    assert client.put("/trainees/me", headers=trainee, json={"phone": same_phone}).status_code == 200
    assert client.put("/trainees/me", headers=trainee, json={"phone": "9999999999"}).status_code == 403
    assert client.put("/trainees/me", headers=trainee,
                      json={"phone": "9999999999", "current_password": "wrong"}).status_code == 403
    r = client.put("/trainees/me", headers=trainee, json={"phone": "9999999999", "current_password": "Demo@1234"})
    assert r.status_code == 200 and r.json()["phone"] == "9999999999"


def test_change_email_and_password_require_reauth(client):
    client.post("/auth/register", json={"name": "Pw", "email": "pw@example.com", "password": "Passw0rd!"})
    h = {"Authorization": "Bearer " + client.post("/auth/login", json={"email": "pw@example.com",
                                                                      "password": "Passw0rd!"}).json()["access_token"]}
    assert client.post("/auth/change-password", headers=h,
                       json={"current_password": "wrong", "new_password": "NewPassw0rd"}).status_code == 403
    assert client.post("/auth/change-password", headers=h,
                       json={"current_password": "Passw0rd!", "new_password": "NewPassw0rd"}).status_code == 204
    assert client.post("/auth/login", json={"email": "pw@example.com", "password": "NewPassw0rd"}).status_code == 200
    assert client.post("/auth/change-email", headers=h,
                       json={"current_password": "NewPassw0rd", "new_email": "trainee1@sih26135-demo.com"}).status_code == 409
    r = client.post("/auth/change-email", headers=h, json={"current_password": "NewPassw0rd", "new_email": "pw2@example.com"})
    assert r.status_code == 200 and r.json()["email"] == "pw2@example.com"


def test_employment_history(client, trainee3):
    r = client.post("/trainees/me/employment", headers=trainee3, json={
        "company_name": "Acme", "role_title": "Intern", "location": "Kochi", "start_date": "2025-01-01",
        "end_date": "2025-06-30", "employment_type": "INTERNSHIP", "skills_used": ["JavaScript", "Git"]})
    assert r.status_code == 201, r.text
    e = r.json()
    assert e["start_date"] == "2025-01-01" and not e["is_current"] and e["verification_status"] == "UNVERIFIED"
    assert client.get("/trainees/me", headers=trainee3).json()["employment_status"] == "UNEMPLOYED"
    cur = client.post("/trainees/me/employment", headers=trainee3, json={
        "company_name": "Beta", "role_title": "Dev", "location": "Kochi", "start_date": "2025-08-01"}).json()
    assert client.get("/trainees/me", headers=trainee3).json()["employment_status"] == "EMPLOYED"
    assert client.delete(f"/trainees/me/employment/{cur['id']}", headers=trainee3).status_code == 204
    assert client.get("/trainees/me", headers=trainee3).json()["employment_status"] == "UNEMPLOYED"
    bad = {"company_name": "X", "role_title": "Y", "location": "Z", "start_date": "2025-05-01", "end_date": "2025-01-01"}
    assert client.post("/trainees/me/employment", headers=trainee3, json=bad).status_code == 422
    r = client.put(f"/trainees/me/employment/{e['id']}", headers=trainee3,
                   json={**bad, "end_date": "2025-09-01"})
    assert r.status_code == 200 and r.json()["company_name"] == "X"


RESUME = """Rahul Nair
rahul@example.com | +91 98765 00003
Summary: Frontend developer.
Skills: JavaScript, React, Git, HTML, CSS
Experience: Intern at Acme building React dashboards that reduced reporting time by 30%.
Projects: Placement portal in React and Node.js.
Education: MCA, 2024
Certifications: Full-Stack Web with React
""" + ("Worked on responsive user interfaces and component libraries. " * 30)


def test_resume_upload_replace_download_analyze(client, trainee3):
    assert client.get("/trainees/me/resume", headers=trainee3).status_code == 404
    r = client.post("/trainees/me/resume", headers=trainee3, files={"file": ("cv.txt", RESUME.encode(), "text/plain")})
    assert r.status_code == 201 and r.json()["text_extracted"]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", "<w:document><w:p><w:t>" + RESUME.replace("\n", "</w:t></w:p><w:p><w:t>")
                   + "</w:t></w:p></w:document>")
    r2 = client.post("/trainees/me/resume", headers=trainee3, files={"file": ("cv.docx", buf.getvalue(),
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
    assert r2.status_code == 201 and r2.json()["id"] == r.json()["id"] and r2.json()["original_filename"] == "cv.docx"
    assert client.get("/trainees/me/resume/file", headers=trainee3).content == buf.getvalue()
    a = client.post("/trainees/me/resume/analyze", headers=trainee3, json={
        "target_role": "Full Stack Developer",
        "job_description": "We need React, Node.js, PostgreSQL and AWS experience. Docker is a plus."}).json()
    assert 0 <= a["ats_score"] <= 100 and a["engine"] == "rule-based-v1" and a["ai_model"] is None
    assert {"PostgreSQL", "AWS", "Docker"} <= set(a["missing_skills"])
    assert {"React", "Node.js"} <= set(a["matched_skills"])  # both appear in the resume text
    for k in ["missing_keywords", "strengths", "weaknesses", "suggestions", "recommended_skills", "recommended_projects"]:
        assert k in a
    job_id = client.get("/jobs").json()[0]["id"]
    assert client.post("/trainees/me/resume/analyze", headers=trainee3,
                       json={"target_role": "Dev", "job_id": job_id}).status_code == 200
    assert client.get("/trainees/me/resume", headers=trainee3).json()["last_analysis"]["ats_score"] >= 0


def test_upload_validation(client, trainee3):
    assert client.post("/trainees/me/resume", headers=trainee3,
                       files={"file": ("x.exe", b"MZ", "application/octet-stream")}).status_code == 415
    assert client.post("/trainees/me/resume", headers=trainee3,
                       files={"file": ("x.txt", b"", "text/plain")}).status_code == 400
    big = b"a" * (5 * 1024 * 1024 + 1)
    assert client.post("/trainees/me/resume", headers=trainee3,
                       files={"file": ("x.txt", big, "text/plain")}).status_code == 413


def test_announcements_feed_by_audience(client, trainee, employee):
    t = [a["title"] for a in client.get("/announcements", headers=trainee).json()]
    e = [a["title"] for a in client.get("/announcements", headers=employee).json()]
    assert "[DEMO] New AWS cohort" in t and "[DEMO] New AWS cohort" not in e
    assert "[DEMO] Upload employment proof" in e and "[DEMO] Upload employment proof" not in t


# --- employee --------------------------------------------------------------------

def test_employee_dashboard(client, employee):
    d = client.get("/employees/me/dashboard", headers=employee).json()
    assert d["employee_id"].startswith("EMP-") and d["skills"]
    assert d["current_employment"][0]["company_name"] == "TechNova Solutions"
    assert d["past_employment"][0]["company_name"] == "Infosys"
    assert d["total_experience_months"] > 12 and "trainee_uid" in d["related_trainee_info"]


def test_employee_jobs_eligibility(client, employee):
    jobs = client.get("/employees/me/jobs", headers=employee).json()
    cloud = next(j for j in jobs if j["title"] == "Cloud Engineer - AWS")
    assert cloud["experience_met"] and cloud["education_met"]
    assert "AWS" in cloud["skills_to_improve"] and "Docker" in cloud["matching_skills"]
    assert all(0 <= j["eligibility_score"] <= 100 for j in jobs)
    assert jobs == sorted(jobs, key=lambda j: -j["eligibility_score"])
    eligible = client.get("/employees/me/jobs?eligible_only=true", headers=employee).json()
    assert all(j["eligible"] for j in eligible)


def test_submission_skill_extraction_and_admin_review(client, employee, admin):
    dash = client.get("/employees/me/dashboard", headers=employee).json()
    current_id = dash["current_employment"][0]["id"]
    r = client.post("/employees/me/submissions", headers=employee,
                    data={"file_type": "EXPERIENCE_LETTER", "description": "Worked with Ruby and PostgreSQL",
                          "employment_id": current_id},
                    files={"file": ("letter.txt", b"She built services in React and Python.", "text/plain")})
    assert r.status_code == 201, r.text
    s = r.json()
    assert s["submission_id"] == s["id"] and s["verification_status"] == "PENDING"
    assert {"Ruby", "PostgreSQL", "React", "Python"} <= set(s["extracted_skills"])
    skills = {x["skill"]["name"]: x for x in client.get("/employees/me/skills", headers=employee).json()}
    assert skills["Ruby"]["verification_status"] == "PENDING" and skills["Ruby"]["source"] == "DOCUMENT"
    assert client.get(f"/employees/me/submissions/{s['id']}/file", headers=employee).status_code == 200
    # admin review
    pending = client.get("/admin/submissions?status=PENDING", headers=admin).json()
    assert s["id"] in [p["id"] for p in pending]
    rev = client.patch(f"/admin/submissions/{s['id']}/review", headers=admin, json={"status": "VERIFIED", "note": "ok"})
    assert rev.status_code == 200 and rev.json()["reviewed_by"] and rev.json()["reviewed_at"]
    assert client.patch(f"/admin/submissions/{s['id']}/review", headers=admin, json={"status": "VERIFIED"}).status_code == 409
    assert client.patch(f"/admin/submissions/{s['id']}/review", headers=admin, json={"status": "PENDING"}).status_code == 422
    skills = {x["skill"]["name"]: x for x in client.get("/employees/me/skills", headers=employee).json()}
    assert skills["Ruby"]["verification_status"] == "VERIFIED"
    emp = next(e for e in client.get("/employees/me/employment", headers=employee).json() if e["id"] == current_id)
    assert emp["verified"]
    # bad type / someone else's employment
    assert client.post("/employees/me/submissions", headers=employee, data={"file_type": "NOPE"},
                       files={"file": ("a.txt", b"x", "text/plain")}).status_code == 422
    assert client.post("/employees/me/submissions", headers=employee,
                       data={"file_type": "OTHER", "employment_id": str(uuid.uuid4())},
                       files={"file": ("a.txt", b"x", "text/plain")}).status_code == 404


def test_rejected_submission_marks_pending_skills_rejected(client, employee, admin):
    s = client.post("/employees/me/submissions", headers=employee, data={"file_type": "OTHER"},
                    files={"file": ("c.txt", b"Certified in C++ programming", "text/plain")}).json()
    client.patch(f"/admin/submissions/{s['id']}/review", headers=admin, json={"status": "REJECTED"})
    skills = {x["skill"]["name"]: x for x in client.get("/employees/me/skills", headers=employee).json()}
    assert skills["C++"]["verification_status"] == "REJECTED"


def test_employee_analytics(client, employee):
    a = client.get("/employees/me/analytics", headers=employee).json()
    assert a["past_companies"] == ["Infosys"] and a["current_companies"] == ["TechNova Solutions"]
    assert a["total_experience_years"] > 1 and len(a["employment_history"]) == 2
    assert {"Java", "AWS"} <= set(a["skills_gained"])
    events = a["employment_timeline"]
    assert [e["event"] for e in events] == ["JOINED", "LEFT", "JOINED"] and events == sorted(events, key=lambda e: e["date"])


# --- admin -----------------------------------------------------------------------

def test_admin_dashboard_and_location_analytics(client, admin):
    d = client.get("/admin/dashboard", headers=admin).json()
    assert d["employed"] + d["unemployed"] == d["total_trainees"] + d["total_employees"]
    by_state = client.get("/api/admin/analytics/employment-by-state", headers=admin).json()
    assert by_state == d["employment_by_state"]
    for row in by_state:
        assert row["employed_trainees"] + row["unemployed_trainees"] == row["total_trainees"]
        assert row["employment_rate"] == round(row["employed_trainees"] / row["total_trainees"] * 100, 1)
    assert sum(r["total_trainees"] for r in by_state) == d["total_trainees"] + d["total_employees"]
    kerala = client.get("/admin/analytics/employment-by-district?state=kerala", headers=admin).json()
    assert kerala and all(r["state"] == "Kerala" and r["district"] for r in kerala)
    listed = client.get("/admin/trainees?state=Kerala&employment_status=EMPLOYED", headers=admin).json()
    assert all(p["state"] == "Kerala" and p["employment_status"] == "EMPLOYED" for p in listed)


def test_admin_courses_crud(client, admin, trainee3):
    r = client.post("/admin/courses", headers=admin, json={
        "title": "Ruby on Rails Bootcamp", "description": "Rails", "provider": "NSDC", "duration": "4 weeks",
        "difficulty": "INTERMEDIATE", "skills": [{"skill_name": "ruby", "target_level": 3}]})
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["title"] == "Ruby on Rails Bootcamp" and c["skills_covered"] == ["Ruby"] and c["status"] == "ACTIVE"
    assert client.post("/admin/courses", headers=admin, json={"title": "Bad", "provider": "x", "duration": "1w",
                       "skills": [{"skill_name": "Klingon"}]}).status_code == 422
    u = client.patch(f"/admin/courses/{c['id']}", headers=admin,
                     json={"duration": "5 weeks", "skills": [{"skill_name": "Ruby", "target_level": 4},
                                                             {"skill_name": "SQL", "target_level": 2}]}).json()
    assert u["duration"] == "5 weeks" and sorted(u["skills_covered"]) == ["Ruby", "SQL"]
    assert client.delete(f"/admin/courses/{c['id']}", headers=admin).json()["status"] == "INACTIVE"
    assert c["id"] not in [p["id"] for p in client.get("/training/programs", headers=trainee3).json()]
    assert client.post(f"/trainees/me/training/{c['id']}/enroll", headers=trainee3).status_code == 404
    assert client.get("/admin/courses?status=INACTIVE", headers=admin).json()[0]["id"] == c["id"]
    assert client.get(f"/admin/courses/{uuid.uuid4()}", headers=admin).status_code == 404


def test_admin_announcements_crud(client, admin, employee, trainee):
    r = client.post("/admin/announcements", headers=admin, json={
        "title": "Employee townhall", "message": "Friday 4pm", "target_audience": "EMPLOYEES"})
    assert r.status_code == 201
    a = r.json()
    assert a["title"] in [x["title"] for x in client.get("/announcements", headers=employee).json()]
    assert a["title"] not in [x["title"] for x in client.get("/announcements", headers=trainee).json()]
    client.patch(f"/admin/announcements/{a['id']}", headers=admin, json={"expires_at": "2020-01-01T00:00:00Z"})
    assert a["title"] not in [x["title"] for x in client.get("/announcements", headers=employee).json()]
    assert client.patch(f"/admin/announcements/{a['id']}", headers=admin,
                        json={"target_audience": "EVERYONE"}).status_code == 422
    assert client.delete(f"/admin/announcements/{a['id']}", headers=admin).status_code == 204
    assert client.get(f"/admin/announcements/{a['id']}", headers=admin).status_code == 404
    assert client.post("/admin/announcements", headers=trainee, json={"title": "hack", "message": "x"}).status_code == 403


def test_admin_skill_analysis_and_course_recommendations(client, admin):
    rows = client.get("/admin/skills/analysis", headers=admin).json()
    python = next(r for r in rows if r["skill"] == "Python")
    for k in ["demand_score", "jobs_count", "trainees_count", "employees_count", "skill_gap", "trend"]:
        assert k in python
    assert python["jobs_count"] == 4 and python["market_demand"] == 91
    assert python["skill_gap"] == max(0, python["demand_score"] - python["availability"])
    recs = client.get("/admin/skills/course-recommendations", headers=admin).json()
    assert recs and all(r["demand_score"] >= 50 and r["skill_gap"] >= 20 for r in recs)
    assert all(r["recommended_course"] and r["action"] in ("CREATE_COURSE", "PROMOTE_EXISTING") for r in recs)
    r = client.post("/admin/skills", headers=admin, json={"name": "Kubernetes", "market_demand": 80, "trend": "RISING"})
    assert r.status_code == 201
    assert client.post("/admin/skills", headers=admin, json={"name": "kubernetes"}).status_code == 409


# --- pre-existing endpoints still work ---------------------------------------------

def test_legacy_endpoints_unchanged(client, trainee, employer, admin):
    job_id = client.get("/jobs").json()[0]["id"]
    assert client.get(f"/jobs/{job_id}/match", headers=trainee).status_code == 200
    assert client.get(f"/jobs/{job_id}/skill-gap", headers=trainee).status_code == 200
    assert client.get("/trainees/me/applications", headers=trainee).status_code == 200
    assert client.get("/employers/me/analytics", headers=employer).status_code == 200
    for p in ["/analytics/overview", "/analytics/applications-by-status", "/analytics/skills-demand-supply"]:
        assert client.get(p, headers=admin).status_code == 200
