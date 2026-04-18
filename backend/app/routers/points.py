from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.core.database import get_db
from app.models.candidate import Candidate

router = APIRouter(prefix="/points", tags=["points"])

POINT_AMOUNTS: dict[str, int] = {
    "resume_uploaded": 20,
    "onboarding_complete": 100,
    "referral": 200,
    "offer_confirmed": 500,
}


class AddPointsRequest(BaseModel):
    event: str
    amount: int | None = None


@router.get("/{candidate_id}")
async def get_points(candidate_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    prefs = candidate.preferences or {}
    return {
        "balance": candidate.points,
        "history": prefs.get("points_history", []),
    }


@router.post("/{candidate_id}/add")
async def add_points(
    candidate_id: int,
    body: AddPointsRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    amount = body.amount if body.amount is not None else POINT_AMOUNTS.get(body.event, 0)

    prefs = dict(candidate.preferences or {})
    history: list[dict] = list(prefs.get("points_history", []))
    history.append(
        {
            "event": body.event,
            "amount": amount,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
    )
    prefs["points_history"] = history
    candidate.preferences = prefs
    flag_modified(candidate, "preferences")
    candidate.points = (candidate.points or 0) + amount

    await db.commit()
    await db.refresh(candidate)
    return {"balance": candidate.points, "event": body.event, "amount": amount}
