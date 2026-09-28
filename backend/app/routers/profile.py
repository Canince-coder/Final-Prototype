"""Personal-profile endpoints shared by trainees and employees.

`build_profile_router` is mounted twice: at /trainees/me (TRAINEE only) and at
/employees/me (EMPLOYEE only), so each role keeps its own gated endpoints.
"""
import uuid
from datetime import datetime, timezone
from typing import Callable

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.document import Resume
from app.models.employment import Employment
from app.models.enums import EmploymentStatus, SkillSource, VerificationStatus
from app.models.job import Job, JobRequirement
from app.models.project import Project
from app.models.skill import Skill, TraineeSkill
from app.models.trainee import Trainee
from app.schemas.portal import (
    AtsAnalysisOut,
    EmploymentIn,
    EmploymentOut,
    ProjectIn,
    ProjectOut,
    ResumeAnalyzeIn,
    ResumeOut,
)
from app.schemas.skill import ProjectRef, TraineeSkillCreate, TraineeSkillOut, TraineeSkillUpdate
from app.services import files
from app.services.assessment import analyze_resume, assess_project
from app.services.skills import apply_detected_skills, extract_skills


def _404(what: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found")


def skills_out(db: Session, profile: Trainee) -> list[TraineeSkillOut]:
    """Profile skills with the projects that evidence each skill."""
    rows = db.scalars(
        select(TraineeSkill)
        .where(TraineeSkill.trainee_id == profile.id)
        .options(selectinload(TraineeSkill.skill))
        .order_by(TraineeSkill.created_at)
    ).all()
    projects = db.scalars(select(Project).where(Project.trainee_id == profile.id)).all()
    out = []
    for row in rows:
        item = TraineeSkillOut.model_validate(row)
        item.projects = [
            ProjectRef(id=p.id, title=p.title, overall_score=p.overall_score)
            for p in projects if row.skill.name in (p.detected_skills or [])
        ]
        out.append(item)
    return out


def sync_employment_status(db: Session, profile: Trainee) -> None:
    has_current = db.scalar(
        select(Employment.id).where(Employment.trainee_id == profile.id, Employment.end_date.is_(None)).limit(1)
    )
    profile.employment_status = EmploymentStatus.EMPLOYED if has_current else EmploymentStatus.UNEMPLOYED


def build_profile_router(prefix: str, tag: str, current_profile: Callable) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    # --- My Skills ---------------------------------------------------------

    @router.get("/skills", response_model=list[TraineeSkillOut])
    def list_my_skills(profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)):
        return skills_out(db, profile)

    @router.post("/skills", response_model=TraineeSkillOut, status_code=status.HTTP_201_CREATED)
    def add_my_skill(
        payload: TraineeSkillCreate, profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)
    ):
        if payload.skill_id is not None:
            skill = db.get(Skill, payload.skill_id)
        else:
            skill = db.scalar(select(Skill).where(Skill.name.ilike(payload.skill_name.strip())))
        if skill is None:
            raise _404("Skill")
        already = db.scalar(
            select(TraineeSkill).where(TraineeSkill.trainee_id == profile.id, TraineeSkill.skill_id == skill.id)
        )
        if already is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Skill already added for this trainee")
        row = TraineeSkill(trainee_id=profile.id, skill_id=skill.id, proficiency_level=payload.proficiency_level)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    def _own_skill(db: Session, profile: Trainee, skill_row_id: uuid.UUID) -> TraineeSkill:
        row = db.get(TraineeSkill, skill_row_id)
        if row is None or row.trainee_id != profile.id:
            raise _404("Skill entry")
        return row

    @router.patch("/skills/{skill_row_id}", response_model=TraineeSkillOut)
    def update_my_skill(
        skill_row_id: uuid.UUID,
        payload: TraineeSkillUpdate,
        profile: Trainee = Depends(current_profile),
        db: Session = Depends(get_db),
    ):
        row = _own_skill(db, profile, skill_row_id)
        row.proficiency_level = payload.proficiency_level
        if row.verification_status == VerificationStatus.VERIFIED:
            # self-edits invalidate a prior verification
            row.verification_status = VerificationStatus.UNVERIFIED
        db.commit()
        db.refresh(row)
        return row

    @router.delete("/skills/{skill_row_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_my_skill(
        skill_row_id: uuid.UUID, profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)
    ):
        db.delete(_own_skill(db, profile, skill_row_id))
        db.commit()

    # --- Projects + competency assessment ------------------------------------

    def _assess(db: Session, profile: Trainee, project: Project) -> list[str]:
        detected = extract_skills(db, project.title, project.description, ", ".join(project.technologies))
        result = assess_project(
            title=project.title,
            description=project.description,
            technologies=project.technologies,
            repository_url=project.repository_url,
            detected_skills=detected,
        )
        project.detected_skills = detected
        project.assessment = result
        project.overall_score = result["overall_score"]
        project.assessed_at = datetime.now(timezone.utc)
        return apply_detected_skills(
            db, profile, detected,
            source=SkillSource.PROJECT_ASSESSMENT,
            level=round(result["overall_score"]),
            competency=result["overall_score"],
        )

    def _own_project(db: Session, profile: Trainee, project_id: uuid.UUID) -> Project:
        project = db.get(Project, project_id)
        if project is None or project.trainee_id != profile.id:
            raise _404("Project")
        return project

    @router.get("/projects", response_model=list[ProjectOut])
    def list_projects(profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)):
        return db.scalars(
            select(Project).where(Project.trainee_id == profile.id).order_by(Project.created_at.desc())
        ).all()

    @router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
    def submit_project(payload: ProjectIn, profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)):
        """Submit a project; it is assessed immediately (rule-based engine, see response `engine`)."""
        project = Project(
            trainee_id=profile.id,
            title=payload.title,
            description=payload.description,
            technologies=[t.strip() for t in payload.technologies if t.strip()],
            repository_url=str(payload.repository_url) if payload.repository_url else None,
        )
        db.add(project)
        db.flush()
        touched = _assess(db, profile, project)
        db.commit()
        db.refresh(project)
        project.skills_updated = touched
        return project

    @router.get("/projects/{project_id}", response_model=ProjectOut)
    def get_project(project_id: uuid.UUID, profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)):
        return _own_project(db, profile, project_id)

    @router.post("/projects/{project_id}/assess", response_model=ProjectOut)
    def reassess_project(
        project_id: uuid.UUID, profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)
    ):
        project = _own_project(db, profile, project_id)
        touched = _assess(db, profile, project)
        db.commit()
        db.refresh(project)
        project.skills_updated = touched
        return project

    @router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_project(project_id: uuid.UUID, profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)):
        db.delete(_own_project(db, profile, project_id))
        db.commit()

    # --- Employment history -----------------------------------------------

    def _own_employment(db: Session, profile: Trainee, employment_id: uuid.UUID) -> Employment:
        row = db.get(Employment, employment_id)
        if row is None or row.trainee_id != profile.id:
            raise _404("Employment record")
        return row

    def _apply_employment(db: Session, profile: Trainee, row: Employment, payload: EmploymentIn) -> None:
        row.company_name = payload.company_name
        row.role_title = payload.role_title
        row.location = payload.location
        row.joining_date = payload.start_date
        row.end_date = payload.end_date
        row.employment_type = payload.employment_type
        row.skills_used = sorted({s.strip() for s in payload.skills_used if s.strip()})
        row.salary = payload.salary
        # self-reported edits need re-verification
        row.verification_status = VerificationStatus.UNVERIFIED
        db.flush()
        apply_detected_skills(
            db, profile, extract_skills(db, ", ".join(row.skills_used)), source=SkillSource.EMPLOYMENT, level=2
        )
        sync_employment_status(db, profile)

    @router.get("/employment", response_model=list[EmploymentOut])
    def list_employment(profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)):
        return db.scalars(
            select(Employment).where(Employment.trainee_id == profile.id).order_by(Employment.joining_date.desc())
        ).all()

    @router.post("/employment", response_model=EmploymentOut, status_code=status.HTTP_201_CREATED)
    def add_employment(payload: EmploymentIn, profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)):
        row = Employment(trainee_id=profile.id)
        db.add(row)
        _apply_employment(db, profile, row, payload)
        db.commit()
        db.refresh(row)
        return row

    @router.put("/employment/{employment_id}", response_model=EmploymentOut)
    def update_employment(
        employment_id: uuid.UUID,
        payload: EmploymentIn,
        profile: Trainee = Depends(current_profile),
        db: Session = Depends(get_db),
    ):
        row = _own_employment(db, profile, employment_id)
        _apply_employment(db, profile, row, payload)
        db.commit()
        db.refresh(row)
        return row

    @router.delete("/employment/{employment_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_employment(
        employment_id: uuid.UUID, profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)
    ):
        db.delete(_own_employment(db, profile, employment_id))
        db.flush()
        sync_employment_status(db, profile)
        db.commit()

    # --- Resume --------------------------------------------------------------

    def _my_resume(db: Session, profile: Trainee) -> Resume:
        resume = db.scalar(select(Resume).where(Resume.trainee_id == profile.id))
        if resume is None:
            raise _404("Resume")
        return resume

    @router.post("/resume", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
    def upload_resume(
        file: UploadFile = File(..., description=".pdf, .docx or .txt"),
        profile: Trainee = Depends(current_profile),
        db: Session = Depends(get_db),
    ):
        """Upload a resume. Uploading again replaces the current one."""
        stored, size = files.save_upload(file, "resumes", files.DOCUMENT_EXTS)
        resume = db.scalar(select(Resume).where(Resume.trainee_id == profile.id))
        old = resume.stored_filename if resume else None
        if resume is None:
            resume = Resume(trainee_id=profile.id)
            db.add(resume)
        resume.original_filename = file.filename
        resume.stored_filename = stored
        resume.content_type = file.content_type or "application/octet-stream"
        resume.size_bytes = size
        resume.text_content = files.extract_text(stored)
        resume.last_analysis = None
        resume.uploaded_at = datetime.now(timezone.utc)
        db.commit()
        if old:
            files.delete_stored(old)
        db.refresh(resume)
        return resume

    @router.get("/resume", response_model=ResumeOut)
    def get_resume(profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)):
        return _my_resume(db, profile)

    @router.get("/resume/file", response_class=FileResponse)
    def download_resume(profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)):
        resume = _my_resume(db, profile)
        path = files.stored_path(resume.stored_filename)
        if not path.exists():
            raise _404("Resume file")
        return FileResponse(path, media_type=resume.content_type, filename=resume.original_filename)

    @router.delete("/resume", status_code=status.HTTP_204_NO_CONTENT)
    def delete_resume(profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)):
        resume = _my_resume(db, profile)
        stored = resume.stored_filename
        db.delete(resume)
        db.commit()
        files.delete_stored(stored)

    @router.post("/resume/analyze", response_model=AtsAnalysisOut)
    def analyze_my_resume(
        payload: ResumeAnalyzeIn, profile: Trainee = Depends(current_profile), db: Session = Depends(get_db)
    ):
        """ATS-style analysis of the uploaded resume against a target role / job description.
        Rule-based engine (see `engine` / `ai_model` in the response)."""
        resume = _my_resume(db, profile)
        if not (resume.text_content or "").strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="No text could be extracted from the resume (scanned PDF?). Upload a text-based PDF, DOCX or TXT.",
            )
        job_description = payload.job_description
        if payload.job_id is not None:
            job = db.scalar(
                select(Job).where(Job.id == payload.job_id)
                .options(selectinload(Job.requirements).selectinload(JobRequirement.skill))
            )
            if job is None:
                raise _404("Job")
            job_description = job_description or job.description or ""
            job_skills = [rq.skill.name for rq in job.requirements]
        else:
            job_skills = extract_skills(db, payload.target_role, job_description)
        result = analyze_resume(
            resume_text=resume.text_content,
            target_role=payload.target_role,
            job_description=job_description,
            resume_skills=extract_skills(db, resume.text_content),
            job_skills=job_skills,
        )
        resume.last_analysis = result
        db.commit()
        return result

    return router
