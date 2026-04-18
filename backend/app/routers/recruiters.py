from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.match import Match, MatchStatus
from app.models.recruiter import Recruiter
from app.models.user import User, UserRole

router = APIRouter(prefix="/recruiters", tags=["recruiters"])


class RecruiterCreate(BaseModel):
    email: str
    company: str
    user_id: str = ""  # Supabase UUID — optional for dev mode


@router.post("/")
async def create_recruiter(body: RecruiterCreate, db: AsyncSession = Depends(get_db)):
    """Idempotent — returns existing recruiter if email already registered."""
    user_row = await db.execute(select(User).where(User.email == body.email))
    user = user_row.scalar_one_or_none()

    if user is None:
        user = User(
            email=body.email,
            role=UserRole.recruiter,
            supabase_id=body.user_id or None,
        )
        db.add(user)
        await db.flush()
    elif user.supabase_id is None and body.user_id:
        user.supabase_id = body.user_id

    rec_row = await db.execute(select(Recruiter).where(Recruiter.user_id == user.id))
    recruiter = rec_row.scalar_one_or_none()

    if recruiter is None:
        recruiter = Recruiter(
            user_id=user.id,
            company=body.company,
            plan="free",
            invites_left=5,
        )
        db.add(recruiter)
        await db.flush()

    await db.commit()
    await db.refresh(recruiter)
    return _serialize(recruiter, user.email)


@router.get("/{recruiter_id}")
async def get_recruiter(recruiter_id: int, db: AsyncSession = Depends(get_db)):
    rec_row = await db.execute(select(Recruiter).where(Recruiter.id == recruiter_id))
    recruiter = rec_row.scalar_one_or_none()
    if recruiter is None:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    user_row = await db.execute(select(User).where(User.id == recruiter.user_id))
    user = user_row.scalar_one()
    return _serialize(recruiter, user.email)


@router.post("/{recruiter_id}/invite/{match_id}")
async def invite_candidate(
    recruiter_id: int,
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict | None = Depends(get_current_user),
):
    rec_row = await db.execute(select(Recruiter).where(Recruiter.id == recruiter_id))
    recruiter = rec_row.scalar_one_or_none()
    if recruiter is None:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    if current_user:
        user_row = await db.execute(
            select(User).where(User.supabase_id == current_user["user_id"])
        )
        user = user_row.scalar_one_or_none()
        if user and recruiter.user_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden")

    if recruiter.invites_left == 0:
        raise HTTPException(status_code=402, detail="upgrade plan to send more invites")

    match_row = await db.execute(select(Match).where(Match.id == match_id))
    match = match_row.scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    match.status = MatchStatus.invited
    if recruiter.invites_left > 0:
        recruiter.invites_left -= 1

    await db.commit()
    await db.refresh(recruiter)
    return {
        "success": True,
        "match_id": match_id,
        "invites_left": recruiter.invites_left,
    }


def _serialize(r: Recruiter, email: str) -> dict:
    return {
        "recruiter_id": r.id,
        "email": email,
        "company": r.company,
        "plan": r.plan,
        "invites_left": r.invites_left,
    }
