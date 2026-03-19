"""
main.py — FastAPI application entry point.

Start the server:
    uvicorn api.main:app --reload --port 8000

Interactive docs:
    http://localhost:8000/docs   (Swagger UI)
    http://localhost:8000/redoc  (ReDoc)
"""

from contextlib import asynccontextmanager
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from .database import Base, engine
from .routes import router
from .template_routes import router as template_router
from .batch_routes import router as batch_router
from .auth import router as auth_router, get_current_user
from fastapi import Depends


# ---------------------------------------------------------------------------
# Lifespan — runs once at startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables that don't exist yet (idempotent)
    Base.metadata.create_all(bind=engine)
    yield
    # Nothing to clean up for SQLite


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Saraithong Superassistant System",
    description=(
        "Generate DOCX + PDF from {{placeholder}} templates and manage "
        "case records in SQLite.\n\n"
        "**POST /generate** — fill template → DOCX + PDF → persist case\n\n"
        "**POST /cases** — persist case without generating files\n\n"
        "**GET /cases** — paginated case list\n\n"
        "**GET /cases/{id}** — single case"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(router, dependencies=[Depends(get_current_user)])
app.include_router(template_router, dependencies=[Depends(get_current_user)])
app.include_router(batch_router, dependencies=[Depends(get_current_user)])


# ---------------------------------------------------------------------------
# Health check (bonus — not in spec but always useful)
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"], summary="Health check")
def health():
    return {"status": "ok"}
