from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.candidate import Candidate
from app.models.user import User, UserRole
from app.services.resume import extract_text_from_pdf, process_resume

router = APIRouter(prefix="/candidates", tags=["candidates"])


class CandidateCreate(BaseModel):
    email: str
    user_id: str  # Supabase UUID — stored as supabase_id on the User row


@router.post("/")
async def create_candidate(body: CandidateCreate, db: AsyncSession = Depends(get_db)):
    """Idempotent — returns existing candidate if email already registered."""
    user_row = await db.execute(select(User).where(User.email == body.email))
    user = user_row.scalar_one_or_none()

    if user is None:
        user = User(email=body.email, role=UserRole.candidate, supabase_id=body.user_id or None)
        db.add(user)
        await db.flush()
    elif user.supabase_id is None and body.user_id:
        user.supabase_id = body.user_id

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


@router.get("/by-user/{supabase_uid}")
async def get_candidate_by_user(supabase_uid: str, db: AsyncSession = Depends(get_db)):
    """Look up a candidate by Supabase user ID."""
    user_row = await db.execute(select(User).where(User.supabase_id == supabase_uid))
    user = user_row.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="No candidate for this user")

    cand_row = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = cand_row.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=404, detail="No candidate for this user")

    return {"candidate_id": candidate.id, "user_id": user.id}


@router.post("/resume")
async def upload_resume(
    candidate_id: str | None = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict | None = Depends(get_current_user),
):
    if current_user:
        # Auth mode: resolve candidate from JWT
        user_row = await db.execute(
            select(User).where(User.supabase_id == current_user["user_id"])
        )
        user = user_row.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=404, detail="Please complete onboarding first")
        cand_row = await db.execute(
            select(Candidate).where(Candidate.user_id == user.id)
        )
        cand = cand_row.scalar_one_or_none()
        if cand is None:
            raise HTTPException(status_code=404, detail="Candidate not found")
        cid = cand.id
    else:
        # Dev mode: fall back to form field
        if not candidate_id:
            raise HTTPException(status_code=422, detail="candidate_id required in dev mode")
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
