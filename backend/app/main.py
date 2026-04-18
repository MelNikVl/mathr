import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.database import Base, engine
from app.models import candidate, job, match, user  # noqa: F401 — registers models
from app.models import recruiter  # noqa: F401 — registers Recruiter table
from app.routers import (
    billing,
    candidates,
    health,
    jobs,
    matches,
    onboarding,
    points,
    recruiters,
)

logger = logging.getLogger("matchr")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            # PG 12+: ADD VALUE can run inside a transaction
            try:
                await conn.execute(
                    text("ALTER TYPE matchstatus ADD VALUE IF NOT EXISTS 'invited'")
                )
            except Exception:
                pass  # enum doesn't exist yet — create_all will create it with 'invited'
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        logger.warning("DB unavailable at startup: %s", exc)
    yield


app = FastAPI(title="matchr", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(candidates.router)
app.include_router(jobs.router)
app.include_router(matches.router)
app.include_router(onboarding.router)
app.include_router(points.router)
app.include_router(recruiters.router)
app.include_router(billing.router)
