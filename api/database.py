"""
database.py — SQLAlchemy engine, declarative base, and session dependency.

SQLite is stored at <project-root>/cases.db.
The `get_db` function is a FastAPI dependency that yields a Session and
guarantees it is closed when the request is done.
"""

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session

# Resolve path relative to this file's parent (project root)
_DB_PATH = Path(__file__).parent.parent / "cases.db"
DATABASE_URL = f"sqlite:///{_DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    # Required for SQLite when sharing the connection across threads
    connect_args={"check_same_thread": False},
    # Echo SQL to stdout — set to False in production
    echo=False,
)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def get_db():
    """Yield a SQLAlchemy Session; always closed on exit."""
    with Session(engine) as session:
        yield session
