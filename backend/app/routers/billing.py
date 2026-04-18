from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.models.recruiter import Recruiter

router = APIRouter(prefix="/billing", tags=["billing"])

PLAN_CONFIG: dict[str, dict] = {
    "starter": {"invites": 50},
    "pro": {"invites": -1},  # -1 = unlimited
}


class CheckoutRequest(BaseModel):
    recruiter_id: int
    plan: str


@router.post("/create-checkout")
async def create_checkout(body: CheckoutRequest):
    plan = body.plan.lower()
    if plan not in PLAN_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid plan. Use 'starter' or 'pro'.")

    if settings.STRIPE_SECRET_KEY:
        import stripe  # type: ignore[import]

        stripe.api_key = settings.STRIPE_SECRET_KEY
        price_ids = {
            "starter": settings.STRIPE_STARTER_PRICE_ID,
            "pro": settings.STRIPE_PRO_PRICE_ID,
        }
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_ids[plan], "quantity": 1}],
            success_url=(
                f"http://localhost:3000/recruiter/dashboard"
                f"?upgraded=1&recruiter_id={body.recruiter_id}"
            ),
            cancel_url="http://localhost:3000/recruiter/pricing",
            metadata={"recruiter_id": str(body.recruiter_id), "plan": plan},
        )
        return {"checkout_url": session.url}

    # No Stripe key — mock checkout redirect
    return {
        "checkout_url": (
            f"/recruiter/dashboard"
            f"?upgraded=1&mock=1&recruiter_id={body.recruiter_id}&plan={plan}"
        )
    }


@router.get("/mock-upgrade")
async def mock_upgrade(
    recruiter_id: int, plan: str, db: AsyncSession = Depends(get_db)
):
    """Dev/test endpoint — upgrades plan without a real Stripe payment."""
    plan = plan.lower()
    if plan not in PLAN_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid plan.")

    rec_row = await db.execute(select(Recruiter).where(Recruiter.id == recruiter_id))
    recruiter = rec_row.scalar_one_or_none()
    if recruiter is None:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    recruiter.plan = plan
    recruiter.invites_left = PLAN_CONFIG[plan]["invites"]
    await db.commit()
    await db.refresh(recruiter)
    return {
        "success": True,
        "plan": recruiter.plan,
        "invites_left": recruiter.invites_left,
    }


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Stripe webhook — handles checkout.session.completed to activate plans."""
    if not settings.STRIPE_SECRET_KEY:
        return {"received": True}

    import stripe  # type: ignore[import]

    stripe.api_key = settings.STRIPE_SECRET_KEY
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        meta = event["data"]["object"].get("metadata", {})
        rid = int(meta.get("recruiter_id", 0))
        plan = meta.get("plan", "starter").lower()

        if rid and plan in PLAN_CONFIG:
            rec_row = await db.execute(select(Recruiter).where(Recruiter.id == rid))
            recruiter = rec_row.scalar_one_or_none()
            if recruiter:
                recruiter.plan = plan
                recruiter.invites_left = PLAN_CONFIG[plan]["invites"]
                await db.commit()

    return {"received": True}
