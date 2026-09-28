from fastapi import FastAPI
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.deps import get_current_employee, get_current_trainee
from app.db.session import engine
from app.routers import admin, auth, catalog, employees, trainees, jobs, applications, analytics
from app.routers.profile import build_profile_router

app = FastAPI(title="SIH26135 Backend", version="0.2.0")

routers = [
    auth.router,
    trainees.router,
    build_profile_router("/trainees/me", "trainee profile", get_current_trainee),
    employees.router,
    build_profile_router("/employees/me", "employee profile", get_current_employee),
    jobs.router,
    applications.router,
    analytics.router,
    catalog.router,
    admin.router,
]
for r in routers:
    app.include_router(r)
    # Same endpoints under /api (e.g. /api/admin/analytics/employment-by-state).
    # Hidden from Swagger to avoid listing every route twice.
    app.include_router(r, prefix="/api", include_in_schema=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip().rstrip("/") for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db = "ok"
    except Exception as exc:  # noqa: BLE001
        db = f"error: {exc.__class__.__name__}"
    return {"status": "ok", "database": db}
