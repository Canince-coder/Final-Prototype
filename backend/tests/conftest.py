"""Test setup: a throwaway Postgres database `<dev db>_test`, rebuilt from scratch with
Alembic migrations + seed.py on every run. The dev database is never touched."""
import os
import re
import tempfile
from pathlib import Path

import pytest
from dotenv import dotenv_values

BACKEND = Path(__file__).resolve().parents[1]
dev_url = os.environ.get("DATABASE_URL") or dotenv_values(BACKEND / ".env")["DATABASE_URL"]
TEST_URL = re.sub(r"/(\w+)$", r"/\1_test", dev_url)
os.environ["DATABASE_URL"] = TEST_URL
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="sb_uploads_")
os.environ.setdefault("ADMIN_EMAIL", "admin@sih26135-demo.com")
os.environ.setdefault("ADMIN_PASSWORD", "Test-Admin-Pass-1")

import psycopg2  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402


def _recreate_db() -> None:
    url = make_url(TEST_URL)
    conn = psycopg2.connect(host=url.host, port=url.port or 5432, user=url.username,
                            password=url.password, dbname="postgres")
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)')
        cur.execute(f'CREATE DATABASE "{url.database}"')
    conn.close()


@pytest.fixture(scope="session", autouse=True)
def database():
    _recreate_db()
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    command.upgrade(cfg, "head")
    import seed

    seed.run()
    yield


@pytest.fixture(scope="session")
def client(database):
    from app.main import app

    return TestClient(app)


def _login(client, email, password):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def trainee(client):
    return _login(client, "trainee1@sih26135-demo.com", "Demo@1234")


@pytest.fixture(scope="session")
def trainee3(client):
    return _login(client, "trainee3@sih26135-demo.com", "Demo@1234")


@pytest.fixture(scope="session")
def employee(client):
    return _login(client, "employee1@sih26135-demo.com", "Demo@1234")


@pytest.fixture(scope="session")
def admin(client):
    return _login(client, os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"])


@pytest.fixture(scope="session")
def employer(client):
    return _login(client, "employer1@sih26135-demo.com", "Demo@1234")
