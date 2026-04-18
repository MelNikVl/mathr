import json
import math
import random

import httpx
from openai import AsyncOpenAI

from app.core.config import settings

_PARSE_SYSTEM = """You are a resume parser. Extract information and return ONLY valid JSON with these exact keys:
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


def _mock_parsed() -> dict:
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


def _mock_embedding() -> list[float]:
    rng = random.Random(42)
    raw = [rng.gauss(0, 1) for _ in range(1536)]
    norm = math.sqrt(sum(x * x for x in raw))
    return [x / norm for x in raw]


async def parse_resume(text: str) -> dict:
    if not settings.DEEPSEEK_API_KEY:
        return _mock_parsed()

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
                    {"role": "system", "content": _PARSE_SYSTEM},
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
        return _mock_embedding()

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    resp = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text[:8000],
    )
    return resp.data[0].embedding
