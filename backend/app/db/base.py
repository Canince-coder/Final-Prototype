from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic and metadata see them
from app.models import (  # noqa: E402,F401
    user,
    trainee,
    skill,
    training,
    employer,
    job,
    application,
    employment,
    project,
    document,
    announcement,
)
