from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/sih26135"
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Comma-separated frontend URLs allowed to call the API (add your Vercel URL in production)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    upload_dir: Path = BACKEND_DIR / "uploads"
    max_upload_mb: int = 5

    # Development admin, created/updated by seed.py. Never commit real values.
    admin_email: str | None = None
    admin_password: str | None = None
    admin_name: str = "Platform Admin"


settings = Settings()

if settings.secret_key == "change-me":
    import warnings

    warnings.warn("SECRET_KEY is the insecure default 'change-me'; set it in backend/.env", stacklevel=1)
