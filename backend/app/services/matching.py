from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.models.candidate import Candidate
from app.models.job import Job


def _vec_str(v: list) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


async def match_candidate_to_jobs(
    candidate_id: int, db: AsyncSession, limit: int = 10
) -> list[dict]:
    cand_row = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_row.scalar_one_or_none()
    if not candidate or candidate.embedding is None:
        return []

    cand_structured = candidate.structured or {}
    emb_str = _vec_str(candidate.embedding)

    sql = text("""
        WITH emb AS (SELECT CAST(:emb AS vector(1536)) AS vec)
        SELECT j.id, j.structured,
               (1.0 - (j.embedding <=> emb.vec))::float AS similarity
        FROM jobs j, emb
        WHERE j.embedding IS NOT NULL AND j.active = true
        ORDER BY j.embedding <=> emb.vec
        LIMIT :lim
    """)
    rows = (await db.execute(sql, {"emb": emb_str, "lim": limit * 2})).all()

    scored = []
    for job_id, job_structured, similarity in rows:
        score = float(similarity)
        js = job_structured or {}

        salary_max = js.get("salary_max") or 0
        salary_want = cand_structured.get("salary_expectation") or 0
        if salary_max and salary_want and salary_want <= salary_max:
            score += 0.1

        cand_remote = cand_structured.get("remote_ok")
        job_remote = js.get("remote_ok")
        if cand_remote is not None and job_remote is not None and cand_remote == job_remote:
            score += 0.1

        scored.append({"job_id": job_id, "score": round(score, 4), "job_structured": js})

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


async def match_job_to_candidates(
    job_id: int, db: AsyncSession, limit: int = 10
) -> list[dict]:
    job_row = await db.execute(select(Job).where(Job.id == job_id))
    job = job_row.scalar_one_or_none()
    if not job or job.embedding is None:
        return []

    job_structured = job.structured or {}
    emb_str = _vec_str(job.embedding)

    sql = text("""
        WITH emb AS (SELECT CAST(:emb AS vector(1536)) AS vec)
        SELECT c.id, c.structured,
               (1.0 - (c.embedding <=> emb.vec))::float AS similarity
        FROM candidates c, emb
        WHERE c.embedding IS NOT NULL
        ORDER BY c.embedding <=> emb.vec
        LIMIT :lim
    """)
    rows = (await db.execute(sql, {"emb": emb_str, "lim": limit * 2})).all()

    scored = []
    for cand_id, cand_structured, similarity in rows:
        score = float(similarity)
        cs = cand_structured or {}

        salary_max = job_structured.get("salary_max") or 0
        salary_want = cs.get("salary_expectation") or 0
        if salary_max and salary_want and salary_want <= salary_max:
            score += 0.1

        job_remote = job_structured.get("remote_ok")
        cand_remote = cs.get("remote_ok")
        if cand_remote is not None and job_remote is not None and cand_remote == job_remote:
            score += 0.1

        scored.append({"candidate_id": cand_id, "score": round(score, 4), "candidate_structured": cs})

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]
