"""portal modules: employee role, trainee uid/state, skills metadata, employment history,
training enrollments, projects, resumes, submissions, announcements

Additive migration. Existing rows are backfilled, nothing is dropped except
employments.verified, which is first copied into employments.verification_status.

Revision ID: a1f3c9e2b7d4
Revises: cdb0c92b2d62
Create Date: 2026-09-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1f3c9e2b7d4"
down_revision: Union[str, None] = "cdb0c92b2d62"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _enum(n: int = 32):
    return sa.String(length=n)


def upgrade() -> None:
    # --- roles -----------------------------------------------------------
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'EMPLOYEE'")

    # --- trainees (person profile) ----------------------------------------
    op.add_column("trainees", sa.Column("trainee_uid", sa.String(20), nullable=True))
    op.add_column("trainees", sa.Column("employee_uid", sa.String(20), nullable=True))
    op.add_column("trainees", sa.Column("state", sa.String(120), nullable=True))
    op.add_column("trainees", sa.Column("employment_status", _enum(), server_default="UNEMPLOYED", nullable=False))
    op.add_column("trainees", sa.Column("is_demo", sa.Boolean(), server_default="false", nullable=False))
    # backfill a unique UID for every existing trainee
    op.execute("UPDATE trainees SET trainee_uid = 'TRN-' || upper(substr(md5(id::text || random()::text), 1, 8)) WHERE trainee_uid IS NULL")
    # anyone with an existing employment record is employed
    op.execute("UPDATE trainees SET employment_status = 'EMPLOYED' WHERE id IN (SELECT trainee_id FROM employments)")
    op.create_index("ix_trainees_trainee_uid", "trainees", ["trainee_uid"], unique=True)
    op.create_index("ix_trainees_employee_uid", "trainees", ["employee_uid"], unique=True)
    op.create_index("ix_trainees_state", "trainees", ["state"])
    op.create_index("ix_trainees_employment_status", "trainees", ["employment_status"])

    # --- skills --------------------------------------------------------------
    op.add_column("skills", sa.Column("market_demand", sa.Integer(), nullable=True))
    op.add_column("skills", sa.Column("trend", _enum(), nullable=True))

    op.add_column("trainee_skills", sa.Column("competency_score", sa.Float(), nullable=True))
    op.add_column("trainee_skills", sa.Column("verification_status", _enum(), server_default="UNVERIFIED", nullable=False))
    op.add_column("trainee_skills", sa.Column("source", _enum(), server_default="SELF_REPORTED", nullable=False))
    op.create_check_constraint(
        "ck_competency_0_5", "trainee_skills", "competency_score IS NULL OR competency_score BETWEEN 0 AND 5"
    )
    op.create_index("ix_trainee_skills_trainee_id", "trainee_skills", ["trainee_id"])

    # --- jobs ------------------------------------------------------------
    op.add_column("jobs", sa.Column("min_experience_years", sa.Numeric(4, 1), server_default="0", nullable=False))
    op.add_column("jobs", sa.Column("min_education_level", sa.Integer(), server_default="0", nullable=False))

    # --- training programs / courses --------------------------------------
    op.add_column("training_programs", sa.Column("difficulty", _enum(), server_default="BEGINNER", nullable=False))
    op.add_column("training_programs", sa.Column("status", _enum(), server_default="ACTIVE", nullable=False))
    op.add_column(
        "training_programs",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_training_programs_status", "training_programs", ["status"])

    op.create_table(
        "training_enrollments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("trainee_id", sa.Uuid(), sa.ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("program_id", sa.Uuid(), sa.ForeignKey("training_programs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", _enum(), server_default="ENROLLED", nullable=False),
        sa.Column("enrolled_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("trainee_id", "program_id", name="uq_enrollment_trainee_program"),
    )
    op.create_index("ix_training_enrollments_trainee_id", "training_enrollments", ["trainee_id"])

    # --- employments: support off-platform / past jobs ---------------------
    op.add_column("employments", sa.Column("company_name", sa.String(200), nullable=True))
    op.add_column("employments", sa.Column("role_title", sa.String(160), nullable=True))
    op.add_column("employments", sa.Column("end_date", sa.Date(), nullable=True))
    op.add_column("employments", sa.Column("employment_type", _enum(), server_default="FULL_TIME", nullable=False))
    op.add_column("employments", sa.Column("skills_used", sa.JSON(), nullable=True))
    op.add_column("employments", sa.Column("verification_status", _enum(), server_default="UNVERIFIED", nullable=False))
    op.execute("UPDATE employments e SET company_name = r.company_name FROM employers r WHERE r.id = e.employer_id")
    op.execute("UPDATE employments e SET role_title = r.title FROM job_roles r WHERE r.id = e.job_role_id")
    op.execute("UPDATE employments SET company_name = COALESCE(company_name, 'Unknown'), role_title = COALESCE(role_title, 'Unknown')")
    op.execute("UPDATE employments SET verification_status = CASE WHEN verified THEN 'VERIFIED' ELSE 'UNVERIFIED' END")
    op.execute("UPDATE employments SET skills_used = '[]' WHERE skills_used IS NULL")
    op.alter_column("employments", "company_name", nullable=False)
    op.alter_column("employments", "role_title", nullable=False)
    op.alter_column("employments", "skills_used", nullable=False)
    op.alter_column("employments", "employer_id", nullable=True)
    op.alter_column("employments", "job_role_id", nullable=True)
    # employer/job_role deletion should not wipe a person's work history
    op.drop_constraint("employments_employer_id_fkey", "employments", type_="foreignkey")
    op.drop_constraint("employments_job_role_id_fkey", "employments", type_="foreignkey")
    op.create_foreign_key("employments_employer_id_fkey", "employments", "employers", ["employer_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("employments_job_role_id_fkey", "employments", "job_roles", ["job_role_id"], ["id"], ondelete="SET NULL")
    op.drop_column("employments", "verified")
    op.create_index("ix_employments_trainee_id", "employments", ["trainee_id"])

    # --- new tables -------------------------------------------------------
    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("trainee_id", sa.Uuid(), sa.ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("technologies", sa.JSON(), nullable=False),
        sa.Column("repository_url", sa.String(500), nullable=True),
        sa.Column("overall_score", sa.Float(), nullable=True),
        sa.Column("assessment", sa.JSON(), nullable=True),
        sa.Column("detected_skills", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("assessed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_projects_trainee_id", "projects", ["trainee_id"])

    op.create_table(
        "resumes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("trainee_id", sa.Uuid(), sa.ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("stored_filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("text_content", sa.Text(), nullable=True),
        sa.Column("last_analysis", sa.JSON(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "employment_submissions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("employee_id", sa.Uuid(), sa.ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employment_id", sa.Uuid(), sa.ForeignKey("employments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("file_type", _enum(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("stored_filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("extracted_skills", sa.JSON(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("verification_status", _enum(), server_default="PENDING", nullable=False),
        sa.Column("reviewed_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
    )
    op.create_index("ix_employment_submissions_employee_id", "employment_submissions", ["employee_id"])
    op.create_index("ix_employment_submissions_verification_status", "employment_submissions", ["verification_status"])

    op.create_table(
        "announcements",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("target_audience", _enum(), server_default="ALL", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("announcements")
    op.drop_table("employment_submissions")
    op.drop_table("resumes")
    op.drop_table("projects")

    op.drop_index("ix_employments_trainee_id", "employments")
    op.add_column("employments", sa.Column("verified", sa.Boolean(), server_default="false", nullable=False))
    op.execute("UPDATE employments SET verified = (verification_status = 'VERIFIED')")
    # rows without an on-platform employer cannot satisfy the old NOT NULL FKs
    op.execute("DELETE FROM employments WHERE employer_id IS NULL OR job_role_id IS NULL")
    op.drop_constraint("employments_employer_id_fkey", "employments", type_="foreignkey")
    op.drop_constraint("employments_job_role_id_fkey", "employments", type_="foreignkey")
    op.create_foreign_key("employments_employer_id_fkey", "employments", "employers", ["employer_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("employments_job_role_id_fkey", "employments", "job_roles", ["job_role_id"], ["id"], ondelete="CASCADE")
    op.alter_column("employments", "employer_id", nullable=False)
    op.alter_column("employments", "job_role_id", nullable=False)
    for col in ("verification_status", "skills_used", "employment_type", "end_date", "role_title", "company_name"):
        op.drop_column("employments", col)

    op.drop_table("training_enrollments")
    op.drop_index("ix_training_programs_status", "training_programs")
    for col in ("created_at", "status", "difficulty"):
        op.drop_column("training_programs", col)

    op.drop_column("jobs", "min_education_level")
    op.drop_column("jobs", "min_experience_years")

    op.drop_index("ix_trainee_skills_trainee_id", "trainee_skills")
    op.drop_constraint("ck_competency_0_5", "trainee_skills", type_="check")
    for col in ("source", "verification_status", "competency_score"):
        op.drop_column("trainee_skills", col)
    op.drop_column("skills", "trend")
    op.drop_column("skills", "market_demand")

    for ix in ("ix_trainees_employment_status", "ix_trainees_state", "ix_trainees_employee_uid", "ix_trainees_trainee_uid"):
        op.drop_index(ix, "trainees")
    for col in ("is_demo", "employment_status", "state", "employee_uid", "trainee_uid"):
        op.drop_column("trainees", col)
    # Postgres cannot drop a single enum value; 'EMPLOYEE' stays in user_role.
