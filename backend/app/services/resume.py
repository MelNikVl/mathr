import io

from fastapi import UploadFile
from PyPDF2 import PdfReader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.candidate import Candidate
from app.services.ai import get_embedding, parse_resume


async def extract_text_from_pdf(file: UploadFile) -> str:
    content = await file.read()
    filename = (file.filename or "").lower()

    # Plain-text fallback (for .txt uploads and testing)
    if filename.endswith(".txt") or (file.content_type or "").startswith("text/"):
        return content.decode("utf-8", errors="replace").strip()

    try:
        reader = PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()
        if text:
            return text
    except Exception:
        pass

    # Last resort: try decoding as plain text
    return content.decode("utf-8", errors="replace").strip()


async def process_resume(candidate_id: int, text: str, db: AsyncSession) -> Candidate:
    parsed, embedding = await _parse_and_embed(text)

    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one()

    candidate.raw_resume = text
    candidate.structured = parsed
    candidate.embedding = embedding

    await db.commit()
    await db.refresh(candidate)
    return candidate


async def _parse_and_embed(text: str):
    import asyncio
    parsed, embedding = await asyncio.gather(parse_resume(text), get_embedding(text))
    return parsed, embedding
