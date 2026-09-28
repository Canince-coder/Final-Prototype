# SIH26135 — Skilling-to-Employment Platform (Backend)

**Stack:** Python · FastAPI · PostgreSQL · SQLAlchemy 2.x · Pydantic v2 · Alembic · JWT

Roles: `TRAINEE`, `EMPLOYEE`, `ADMIN` (+ legacy `EMPLOYER` for job-posting companies).

## Structure

```
backend/
├── app/
│   ├── main.py            # app, router registration (+ /api alias), /health
│   ├── core/              # config (.env), security (JWT, bcrypt, require_role), deps (current trainee/employee)
│   ├── models/            # SQLAlchemy models
│   ├── schemas/           # Pydantic schemas (portal.py = new modules)
│   ├── routers/           # auth, trainees, employees, profile (shared skills/projects/employment/resume),
│   │                      # jobs, applications, analytics (legacy), catalog, admin
│   └── services/          # matching, analytics, skills (extraction), assessment (project + ATS), files
├── alembic/               # migrations
├── seed.py                # dev admin (from .env) + DEMO data
├── tests/                 # pytest; uses a separate <db>_test database
└── uploads/               # uploaded files (git-ignored)
```

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
cp .env.example .env            # set DATABASE_URL, SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
alembic upgrade head
python seed.py                  # dev admin + demo data (idempotent)
uvicorn app.main:app --reload
```

Swagger: http://127.0.0.1:8000/docs · Health: `GET /health`

## Tests

```bash
python -m pytest -q
```

Tests drop/recreate `<your db>_test`, run all migrations and the seed, then exercise every module.
The dev database is not touched.

## AI components

There is **no AI/ML model** in this backend. Project assessment, resume/ATS analysis and skill
extraction are transparent rule-based heuristics (`app/services/assessment.py`, `app/services/skills.py`);
responses carry `engine: "rule-based-v1"` and `ai_model: null`. Replace the bodies of
`assess_project` / `analyze_resume` to plug in a model; the response shape stays the same.
