# Backend Integration Notes (SIH 26135)

The frontend was **frozen** during this backend phase — no frontend file was modified
(verified by checksum of all 38 non-`node_modules` files before/after).
This document lists every frontend change needed to consume the updated backend,
plus frontend bugs found during inspection.

- Base URL is unchanged (`http://127.0.0.1:8000`). All existing paths still work.
- Every route is **also** available under `/api` (e.g. `/api/admin/analytics/employment-by-state`).
- Full, interactive contract: `GET /docs` (Swagger).
- `SECRET_KEY` was rotated from the insecure default → **all previously issued tokens are invalid**;
  users must log in again (the existing 401 interceptor already handles this).

---

## 0. Breaking / behavioural changes (read first)

| Change | Impact on current frontend |
|---|---|
| `POST /auth/register` with `role: "ADMIN"` → **403** | `Register.jsx` offers "Admin"; that option now fails. |
| New role `EMPLOYEE` | `Login.jsx` routes to `/${role}/dashboard` → `/employee/dashboard` does not exist yet. |
| `PUT /trainees/me` changing `phone` requires `current_password` → **403** otherwise | `Profile.jsx` works while phone is unchanged; editing phone fails until a password field is added. |
| `PUT /trainees/me` fields sent as `null` are now ignored (was a 500) | none (bug fix) |
| `employments.verified` column replaced by `verification_status` | API still returns `verified: bool`; no current page used it. |

No response field was removed from any existing endpoint; only fields were added.

---

## 1. Login page

Frontend file: `frontend/src/pages/Login.jsx`, `frontend/src/context/AuthContext.jsx`
Problem: routes `navigate(\`/${user.role.toLowerCase()}/dashboard\`)`; there is no `/employee/*` route, so EMPLOYEE users are bounced to `/`.
Backend API involved: `POST /auth/login`
```json
{ "access_token": "...", "token_type": "bearer", "role": "TRAINEE" }
```
`role` is one of `TRAINEE | EMPLOYEE | ADMIN` (`EMPLOYER` still exists as a legacy role).
Required frontend change: add EMPLOYEE routes/layout; optionally use `role` from the login response instead of the extra `GET /auth/me`.
Reason: three-role portal.
Status: Frontend change required later.

## 2. Register page

Frontend file: `frontend/src/pages/Register.jsx`
Problem: offers `ADMIN` (now 403) and no `EMPLOYEE` option; no `state` field.
Backend API involved: `POST /auth/register` — body adds optional `state`; `role` accepts `TRAINEE | EMPLOYEE | EMPLOYER`.
Required frontend change: remove Admin option, add Employee option, add State input (for TRAINEE/EMPLOYEE).
Reason: admin self-registration was a security hole; state drives admin location analytics.
Status: Frontend change required later.

## 3. Account security (email / password)

Frontend file: new UI (e.g. a settings section in Profile)
Backend API involved:
- `POST /auth/change-password` `{current_password, new_password}` → 204 / 403
- `POST /auth/change-email` `{current_password, new_email}` → 200 / 403 / 409
Required frontend change: forms that ask for the current password.
Reason: sensitive changes require re-authentication.
Status: Frontend change required later.

---

## TRAINEE

## 4. Trainee dashboard

Frontend file: `frontend/src/pages/trainee/Dashboard.jsx`
Problem: builds the dashboard from `recommended-jobs` + `applications` only.
Backend API involved: `GET /trainees/me/dashboard` → `trainee_uid, name, email, phone, state, district, location, education, employment_status, current_skills[], competency{...}, training_status{...}, recommended_jobs[], recommended_training[]`
Required frontend change: use the single dashboard call; show UID, competency, training status, recommended training.
Status: Frontend change required later.

## 5. Recommended jobs

Frontend file: `frontend/src/pages/trainee/RecommendedJobs.jsx`
Backend API involved: `GET /trainees/me/recommended-jobs?limit=10` — old fields kept (`job_id, job, employer, location, match_percentage, top_skill_gaps`), new fields added:
```json
{ "title": "...", "company": "...", "required_skills": [], "matching_skills": [],
  "missing_skills": [], "skills_to_improve": [], "match_percentage": 85 }
```
`missing_skills` = not held at all; `skills_to_improve` = held below the required level.
Required frontend change: optional — display matching/missing skills.
Status: Works today; enhancement later.

## 6. Skills → "My Skills"

Frontend file: `frontend/src/pages/trainee/Skills.jsx`
Problem: user must paste a skill UUID ("backend doesn't expose a list-all-skills endpoint").
Backend API involved:
- `GET /skills` — full skill catalog (for a dropdown)
- `POST /trainees/me/skills` — accepts `skill_id` **or** `skill_name`
- `PATCH /trainees/me/skills/{id}` `{proficiency_level}` · `DELETE /trainees/me/skills/{id}`
- `GET /trainees/me/skills` — each item now also has `competency_score` (0-5 or null), `verification_status`, `source`, `projects[]`
Required frontend change: replace the UUID input with a dropdown; show competency, verification, source and associated projects; add edit/delete. Page title already reads "My Skills"; rename the nav entry if needed.
Status: Frontend change required later.

## 7. Projects / competency assessment (new page)

Frontend file: new page
Backend API involved: `GET|POST /trainees/me/projects`, `GET|DELETE /trainees/me/projects/{id}`, `POST /trainees/me/projects/{id}/assess`
POST body: `{title, description (≥20 chars), technologies[], repository_url?}` → project + `assessment`:
```json
{ "overall_score": 4.2, "technical_complexity": 4, "problem_solving": 5, "implementation_quality": 4,
  "technology_usage": 4, "project_completeness": 4, "detected_skills": [], "strengths": [],
  "weaknesses": [], "recommendations": [], "engine": "rule-based-v1", "ai_model": null, "disclaimer": "..." }
```
Detected skills are added to My Skills (source `PROJECT_ASSESSMENT`); `skills_updated` lists them.
Required frontend change: new page. **Show the `disclaimer`** — this is a rule-based engine, not AI.
Status: Frontend change required later.

## 8. Applications → "Training Camp"

Frontend file: `frontend/src/pages/trainee/Applications.jsx`, `frontend/src/components/Layout.jsx` (nav label)
Backend API involved:
- `GET /training/programs` — catalog (`title`, `skills_covered`, `difficulty`, `provider`, `duration`)
- `GET /trainees/me/training?status=ENROLLED|COMPLETED|DROPPED` — history
- `POST /trainees/me/training/{program_id}/enroll`
- `POST /trainees/me/training/enrollments/{enrollment_id}/complete` (adds program skills to My Skills)
- `POST /trainees/me/training/enrollments/{enrollment_id}/drop`
- `GET /trainees/me/recommended-training?target_job_id=` → `{target_jobs, skill_gaps, recommendations[{program, skills_addressed, relevance_score}]}`
Required frontend change: new Training Camp page. Job applications endpoints (`/trainees/me/applications`, `/jobs/{id}/apply`) still exist if the old page is kept elsewhere.
Status: Frontend change required later.

## 9. Profile

Frontend file: `frontend/src/pages/trainee/Profile.jsx`
Backend API involved: `GET /trainees/me` adds `trainee_uid, employee_uid, state, employment_status`.
`PUT /trainees/me` accepts `name, state, district, education, phone, employment_status, current_password`.
Required frontend change: show UID; add State and Employment status inputs; when phone changes, ask for current password.
Reason: phone is a sensitive field.
Status: Frontend change required later (current page still works unless phone is edited).

## 10. Employment (trainee)

Frontend file: `frontend/src/pages/trainee/Employment.jsx`, `frontend/src/api/employment.js`
Problem: page shows "not available"; `createEmployment` posts to `/employment`, which does not exist.
Backend API involved: `GET|POST /trainees/me/employment`, `PUT|DELETE /trainees/me/employment/{id}`
Body: `{company_name, role_title, location, start_date, end_date?, employment_type, skills_used[], salary?}`
Response adds `start_date, is_current, verification_status, verified`.
Required frontend change: implement the page; change `createEmployment` to `POST /trainees/me/employment`.
Status: Frontend change required later.

## 11. Resume + ATS analysis (new page)

Backend API involved (same under `/employees/me/...` for employees):
- `POST /trainees/me/resume` (multipart `file`: .pdf/.docx/.txt, ≤5 MB) — uploading again replaces
- `GET /trainees/me/resume` · `GET /trainees/me/resume/file` (download) · `DELETE /trainees/me/resume`
- `POST /trainees/me/resume/analyze` `{target_role, job_description?, job_id?}` →
  `ats_score, matched_skills, missing_skills, missing_keywords, strengths, weaknesses, suggestions, recommended_skills, recommended_projects, score_breakdown, engine, ai_model, disclaimer`
Errors: 415 bad type, 413 too large, 400 empty, 422 no extractable text (scanned PDF).
Required frontend change: new page; show the rule-based disclaimer.
Status: Frontend change required later.

## 12. Announcements (all roles)

Backend API involved: `GET /announcements` — active, unexpired, filtered to the caller's audience.
Required frontend change: banner/list on dashboards.
Status: Frontend change required later.

---

## EMPLOYEE (entirely new — no frontend exists)

## 13. Employee area

Frontend file: new `pages/employee/*`, routes in `App.jsx`, nav in `Layout.jsx`
Backend API involved:
- `GET /employees/me` · `GET /employees/me/dashboard` (employee_id, skills, experience, current/past employment, related_trainee_info, top_jobs)
- `GET /employees/me/jobs?eligible_only=true` — eligibility = 60% skills + 25% experience + 15% education; adds `eligibility_score, eligible, experience_met, education_met`
- `GET /employees/me/analytics` — past companies, total experience, history, skills gained, timeline
- Skills / projects / employment / resume: same endpoints as trainees under `/employees/me/...`
Status: Frontend change required later.

## 14. Applications → "Submission / Skill Assessment" (employee)

Backend API involved:
- `POST /employees/me/submissions` multipart: `file` (.pdf/.docx/.txt/.png/.jpg), `file_type` (`OFFER_LETTER | EXPERIENCE_LETTER | EMPLOYMENT_CERTIFICATE | PROJECT | OTHER`), `description?`, `employment_id?`
- `GET /employees/me/submissions` · `GET /employees/me/submissions/{id}` · `GET /employees/me/submissions/{id}/file`
Response: `submission_id, employee_id, file_type, uploaded_at, verification_status, reviewed_by, reviewed_at, extracted_skills, skills_updated`.
Skills found in the document/description are added to the profile as `PENDING` until an admin reviews.
Status: Frontend change required later.

---

## ADMIN

## 15. Admin dashboard

Frontend file: `frontend/src/pages/admin/Dashboard.jsx`
Problem (existing bug): this file is a copy of the trainee dashboard — it calls `GET /trainees/me/recommended-jobs` and `GET /trainees/me/applications`, which return **403** for admins.
Backend API involved: `GET /admin/dashboard` → totals + `employment_by_state[]` (`state, total_trainees, employed_trainees, unemployed_trainees, employment_rate, demo_records`) + `demo_data_note`.
Required frontend change: rewrite against `/admin/dashboard`; show that rows with `demo_records > 0` include demo data.
Status: Frontend change required later.

## 16. Location analytics

Backend API involved:
- `GET /admin/analytics/employment-by-state`
- `GET /admin/analytics/employment-by-district?state=Kerala`
- `GET /admin/trainees?state=&district=&employment_status=&role=&limit=&offset=` (drill-down list)
Status: Frontend change required later.

## 17. "Application Panel" → "Courses Needed"

Frontend file: `frontend/src/pages/admin/Funnel.jsx`, `Layout.jsx` nav
Backend API involved:
- `GET /admin/courses?status=ACTIVE|INACTIVE` · `POST /admin/courses` · `GET|PATCH /admin/courses/{id}` · `DELETE /admin/courses/{id}` (soft: sets INACTIVE)
- Body: `{title, description, provider, duration, difficulty (BEGINNER|INTERMEDIATE|ADVANCED), status, skills: [{skill_name, target_level}]}`
- `GET /admin/skills/course-recommendations?min_demand=50&min_gap=20` → `skill, demand_score, skill_gap, recommended_course, existing_courses, action`
Status: Frontend change required later.

## 18. Announcements admin

Backend API involved: `GET|POST /admin/announcements`, `GET|PATCH|DELETE /admin/announcements/{id}`
Body: `{title, message, target_audience (ALL|TRAINEES|EMPLOYEES), expires_at?, is_active}`
Status: Frontend change required later.

## 19. Skill analysis

Frontend file: `frontend/src/pages/admin/SkillsAnalytics.jsx`
Backend API involved: `GET /admin/skills/analysis` → `skill, demand_score, market_demand, internal_demand, jobs_count, trainees_count, employees_count, availability, skill_gap, trend`. `POST /admin/skills` to add vocabulary.
Note: `market_demand` and `trend` are **DEMO seed values**; label them in the UI. The old `/analytics/skills-demand-supply` still works.
Status: Frontend change required later.

## 20. Submission review

Backend API involved: `GET /admin/submissions?status=PENDING`, `GET /admin/submissions/{id}/file`, `PATCH /admin/submissions/{id}/review` `{status: VERIFIED|REJECTED, note?}`
Status: Frontend change required later.

---

## Other frontend bugs found (not fixed — frontend frozen)

| Frontend file | Problem | Backend API | Required change |
|---|---|---|---|
| `pages/employer/Dashboard.jsx` | Copy of trainee dashboard; calls trainee-only endpoints → 403 for employers | `/employers/me/analytics` | Rewrite for employer data |
| `pages/employer/Applications.jsx` | Calls `getMyApplications` (`/trainees/me/applications`) → 403 for employers | none exists for "applications to my jobs" (see Remaining Issues) | Needs a new backend endpoint + page change |
| `pages/employer/Jobs.jsx` | Filters by `user.employer_company`, which `/auth/me` never returns → list always empty | `/jobs` (each job has `employer.company_name`) | Filter by employer id/name from a profile call |
| `api/analytics.js`, `api/employment.js` | Comments claim endpoints don't exist; they do now | — | Update comments |
| `pages/trainee/Skills.jsx` | Text says there's no list-all-skills endpoint | `GET /skills` | Use it |
