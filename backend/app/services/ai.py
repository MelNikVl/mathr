import json
import math
import random

import httpx
from openai import AsyncOpenAI

from app.core.config import settings

_PARSE_RESUME_SYSTEM = """You are a resume parser. Extract information and return ONLY valid JSON with these exact keys:
{
  "name": str,
  "email": str,
  "skills": [str],
  "experience_years": int,
  "level": "junior" | "mid" | "senior",
  "location": str,
  "salary_expectation": int,
  "remote_ok": bool,
  "languages": [str]
}
No markdown, no explanation — raw JSON only."""

_PARSE_JOB_SYSTEM = """You are a job posting parser. Extract information and return ONLY valid JSON with these exact keys:
{
  "title": str,
  "company": str,
  "skills_required": [str],
  "level": "junior" | "mid" | "senior",
  "location": str,
  "salary_min": int,
  "salary_max": int,
  "remote_ok": bool
}
No markdown, no explanation — raw JSON only."""

_MOCK_JOBS = [
    {
        "title": "Senior Python Backend Engineer",
        "company": "TechCorp",
        "skills_required": ["Python", "FastAPI", "PostgreSQL", "Docker", "SQLAlchemy"],
        "level": "senior",
        "location": "San Francisco, CA",
        "salary_min": 140000,
        "salary_max": 180000,
        "remote_ok": True,
    },
    {
        "title": "Frontend React Engineer",
        "company": "StartupXYZ",
        "skills_required": ["React", "TypeScript", "CSS", "GraphQL", "Node.js"],
        "level": "mid",
        "location": "New York, NY",
        "salary_min": 100000,
        "salary_max": 130000,
        "remote_ok": False,
    },
    {
        "title": "DevOps / Platform Engineer",
        "company": "CloudBase",
        "skills_required": ["Docker", "Kubernetes", "AWS", "Terraform", "Python"],
        "level": "mid",
        "location": "Remote",
        "salary_min": 110000,
        "salary_max": 150000,
        "remote_ok": True,
    },
    {
        "title": "Junior Python Developer",
        "company": "DataCo",
        "skills_required": ["Python", "Django", "MySQL", "REST APIs"],
        "level": "junior",
        "location": "Austin, TX",
        "salary_min": 70000,
        "salary_max": 95000,
        "remote_ok": False,
    },
]


def _mock_embedding(seed: int = 42) -> list[float]:
    rng = random.Random(seed)
    raw = [rng.gauss(0, 1) for _ in range(1536)]
    norm = math.sqrt(sum(x * x for x in raw))
    return [x / norm for x in raw]


def _mock_parsed_resume() -> dict:
    return {
        "name": "Alex Johnson",
        "email": "alex.johnson@example.com",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "React"],
        "experience_years": 4,
        "level": "mid",
        "location": "San Francisco, CA",
        "salary_expectation": 120000,
        "remote_ok": True,
        "languages": ["English", "Spanish"],
    }


def _mock_parsed_job(text: str) -> dict:
    idx = abs(hash(text)) % len(_MOCK_JOBS)
    return dict(_MOCK_JOBS[idx])


async def parse_resume(text: str) -> dict:
    if not settings.DEEPSEEK_API_KEY:
        return _mock_parsed_resume()

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.deepseek.com/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": _PARSE_RESUME_SYSTEM},
                    {"role": "user", "content": text[:8000]},
                ],
                "temperature": 0,
            },
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()
        return json.loads(content)


async def parse_job(text: str) -> dict:
    if not settings.DEEPSEEK_API_KEY:
        return _mock_parsed_job(text)

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.deepseek.com/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": _PARSE_JOB_SYSTEM},
                    {"role": "user", "content": text[:8000]},
                ],
                "temperature": 0,
            },
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()
        return json.loads(content)


async def get_embedding(text: str) -> list[float]:
    if not settings.OPENAI_API_KEY:
        seed = abs(hash(text)) % (2**31)
        return _mock_embedding(seed)

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    resp = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text[:8000],
    )
    return resp.data[0].embedding
