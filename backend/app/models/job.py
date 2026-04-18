from sqlalchemy import Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.core.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    recruiter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    raw_text: Mapped[str | None] = mapped_column(Text)
    structured: Mapped[dict | None] = mapped_column(JSONB)
    embedding: Mapped[list | None] = mapped_column(Vector(1536))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
