from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.candidate import Candidate
from app.models.user import User, UserRole
from app.services.resume import extract_text_from_pdf, process_resume

router = APIRouter(prefix="/candidates", tags=["candidates"])


class CandidateCreate(BaseModel):
    email: str
    user_id: str  # Supabase / external user ID (stored for reference, not as FK)


@router.post("/")
async def create_candidate(body: CandidateCreate, db: AsyncSession = Depends(get_db)):
    """Idempotent — returns existing candidate if email already registered."""
    user_row = await db.execute(select(User).where(User.email == body.email))
    user = user_row.scalar_one_or_none()

    if user is None:
        user = User(email=body.email, role=UserRole.candidate)
        db.add(user)
        await db.flush()

    cand_row = await db.execute(
        select(Candidate).where(Candidate.user_id == user.id)
    )
    candidate = cand_row.scalar_one_or_none()

    if candidate is None:
        candidate = Candidate(user_id=user.id, points=0)
        db.add(candidate)
        await db.flush()

    await db.commit()
    await db.refresh(candidate)
    return {"candidate_id": candidate.id, "user_id": user.id}


@router.post("/resume")
async def upload_resume(
    candidate_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    cid = int(candidate_id)
    result = await db.execute(select(Candidate).where(Candidate.id == cid))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    text = await extract_text_from_pdf(file)
    if not text:
        raise HTTPException(status_code=422, detail="Could not extract text from PDF")

    candidate = await process_resume(cid, text, db)
    return _serialize(candidate)


@router.get("/{candidate_id}")
async def get_candidate(candidate_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return _serialize(candidate)


def _serialize(c: Candidate) -> dict:
    return {
        "id": c.id,
        "user_id": c.user_id,
        "structured": c.structured,
        "points": c.points,
        "preferences": c.preferences,
        "has_resume": c.raw_resume is not None,
        "has_embedding": c.embedding is not None,
    }
