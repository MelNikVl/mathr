from fastapi import APIRouter
from pydantic import BaseModel

from app.services.ai import chat_onboarding

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class ChatMessage(BaseModel):
    role: str
    content: str


class OnboardingRequest(BaseModel):
    candidate_id: int
    message: str
    step: int
    history: list[ChatMessage] = []


@router.post("/message")
async def onboarding_message(body: OnboardingRequest):
    history = [{"role": m.role, "content": m.content} for m in body.history]
    reply, complete = await chat_onboarding(body.message, body.step, history)
    return {"reply": reply, "complete": complete}
