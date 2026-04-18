from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.match import Match, MatchStatus

router = APIRouter(prefix="/matches", tags=["matches"])


class MatchCreate(BaseModel):
    candidate_id: int
    job_id: int
    score: float | None = None


class MatchUpdate(BaseModel):
    status: MatchStatus


@router.post("")
async def create_match(body: MatchCreate, db: AsyncSession = Depends(get_db)):
    match = Match(
        candidate_id=body.candidate_id,
        job_id=body.job_id,
        score=body.score,
        status=MatchStatus.pending,
    )
    db.add(match)
    await db.commit()
    await db.refresh(match)
    return _serialize(match)


@router.patch("/{match_id}")
async def update_match(
    match_id: int, body: MatchUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    match.status = body.status
    await db.commit()
    await db.refresh(match)
    return _serialize(match)


@router.get("/candidate/{candidate_id}")
async def get_matches_for_candidate(
    candidate_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Match).where(Match.candidate_id == candidate_id).order_by(Match.matched_at.desc())
    )
    matches = result.scalars().all()
    return [_serialize(m) for m in matches]


def _serialize(m: Match) -> dict:
    return {
        "id": m.id,
        "candidate_id": m.candidate_id,
        "job_id": m.job_id,
        "score": m.score,
        "status": m.status,
        "matched_at": m.matched_at.isoformat() if m.matched_at else None,
    }
