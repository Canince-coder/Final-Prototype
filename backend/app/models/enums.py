import enum

from sqlalchemy import Enum


def str_enum(enum_cls) -> Enum:
    """VARCHAR-backed enum column: adding values later needs no ALTER TYPE migration."""
    return Enum(enum_cls, native_enum=False, length=32)


class UserRole(str, enum.Enum):
    TRAINEE = "TRAINEE"
    EMPLOYEE = "EMPLOYEE"
    ADMIN = "ADMIN"
    # Legacy: job-posting company accounts from the original prototype. Kept so
    # existing employer accounts, jobs and the employer UI keep working.
    EMPLOYER = "EMPLOYER"


class ApplicationStatus(str, enum.Enum):
    APPLIED = "APPLIED"
    SHORTLISTED = "SHORTLISTED"
    INTERVIEW = "INTERVIEW"
    SELECTED = "SELECTED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


class VerificationStatus(str, enum.Enum):
    UNVERIFIED = "UNVERIFIED"
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class EmploymentStatus(str, enum.Enum):
    EMPLOYED = "EMPLOYED"
    UNEMPLOYED = "UNEMPLOYED"


class SkillSource(str, enum.Enum):
    SELF_REPORTED = "SELF_REPORTED"
    PROJECT_ASSESSMENT = "PROJECT_ASSESSMENT"
    TRAINING = "TRAINING"
    DOCUMENT = "DOCUMENT"
    EMPLOYMENT = "EMPLOYMENT"
    RESUME = "RESUME"


class EmploymentType(str, enum.Enum):
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    CONTRACT = "CONTRACT"
    INTERNSHIP = "INTERNSHIP"
    APPRENTICESHIP = "APPRENTICESHIP"
    SELF_EMPLOYED = "SELF_EMPLOYED"


class EnrollmentStatus(str, enum.Enum):
    ENROLLED = "ENROLLED"
    COMPLETED = "COMPLETED"
    DROPPED = "DROPPED"


class CourseStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class Difficulty(str, enum.Enum):
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"


class DocumentType(str, enum.Enum):
    OFFER_LETTER = "OFFER_LETTER"
    EXPERIENCE_LETTER = "EXPERIENCE_LETTER"
    EMPLOYMENT_CERTIFICATE = "EMPLOYMENT_CERTIFICATE"
    PROJECT = "PROJECT"
    OTHER = "OTHER"


class Audience(str, enum.Enum):
    ALL = "ALL"
    TRAINEES = "TRAINEES"
    EMPLOYEES = "EMPLOYEES"


class SkillTrend(str, enum.Enum):
    RISING = "RISING"
    STABLE = "STABLE"
    DECLINING = "DECLINING"
