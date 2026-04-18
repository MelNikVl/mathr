import asyncio

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.job import Job
from app.services.ai import get_embedding, parse_job


async def process_job(job_id: int, raw_text: str, db: AsyncSession) -> Job:
    structured, embedding = await asyncio.gather(
        parse_job(raw_text),
        get_embedding(raw_text),
    )

    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one()

    job.raw_text = raw_text
    job.structured = structured
    job.embedding = embedding

    await db.commit()
    await db.refresh(job)
    return job
