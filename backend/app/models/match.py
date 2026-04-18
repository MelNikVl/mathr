import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MatchStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False)
    score: Mapped[float | None] = mapped_column(Float)
    status: Mapped[MatchStatus] = mapped_column(Enum(MatchStatus), default=MatchStatus.pending)
    matched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
