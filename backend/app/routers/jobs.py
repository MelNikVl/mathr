from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User
from app.services.job import process_job
from app.services.matching import match_candidate_to_jobs, match_job_to_candidates

router = APIRouter(tags=["jobs"])


class JobCreate(BaseModel):
    recruiter_id: int
    raw_text: str


@router.post("/jobs")
async def create_job(body: JobCreate, db: AsyncSession = Depends(get_db)):
    job = Job(recruiter_id=body.recruiter_id, raw_text=body.raw_text)
    db.add(job)
    await db.flush()
    job = await process_job(job.id, body.raw_text, db)
    return _serialize(job)


@router.get("/jobs/{job_id}")
async def get_job(job_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _serialize(job)


@router.get("/jobs/{job_id}/candidates")
async def top_candidates_for_job(
    job_id: int, limit: int = 10, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Job not found")
    matches = await match_job_to_candidates(job_id, db, limit=limit)
    return {"job_id": job_id, "matches": matches}


@router.get("/candidates/{candidate_id}/jobs")
async def top_jobs_for_candidate(
    candidate_id: int,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: dict | None = Depends(get_current_user),
):
    if current_user:
        user_row = await db.execute(
            select(User).where(User.supabase_id == current_user["user_id"])
        )
        user = user_row.scalar_one_or_none()
        if user:
            cand_row = await db.execute(
                select(Candidate).where(
                    Candidate.id == candidate_id, Candidate.user_id == user.id
                )
            )
            if cand_row.scalar_one_or_none() is None:
                raise HTTPException(status_code=403, detail="Forbidden")

    matches = await match_candidate_to_jobs(candidate_id, db, limit=limit)
    return {"candidate_id": candidate_id, "matches": matches}


def _serialize(j: Job) -> dict:
    return {
        "id": j.id,
        "recruiter_id": j.recruiter_id,
        "structured": j.structured,
        "active": j.active,
        "has_embedding": j.embedding is not None,
    }
