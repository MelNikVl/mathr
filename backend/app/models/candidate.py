from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.core.database import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    raw_resume: Mapped[str | None] = mapped_column(Text)
    structured: Mapped[dict | None] = mapped_column(JSONB)
    embedding: Mapped[list | None] = mapped_column(Vector(1536))
    points: Mapped[int] = mapped_column(Integer, default=0)
    preferences: Mapped[dict | None] = mapped_column(JSONB)
