"""Billing endpoints — Stripe checkout, webhook, subscription status."""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Header
from typing import Optional
from pydantic import BaseModel

from app.auth import verify_user
from app.config import settings
from app.firebase_store import (
    add_document,
    get_latest_subscription,
    get_plan,
    query_documents,
    upsert_profile,
    update_document,
)

router = APIRouter(tags=["billing"])
logger = logging.getLogger(__name__)

# ── Price mapping (set real Stripe price IDs in env) ─────────────────────────
PLAN_PRICE_IDS: dict[str, str] = {
    "premium_monthly": getattr(settings, "stripe_price_monthly", "price_monthly_placeholder"),
    "premium_yearly":  getattr(settings, "stripe_price_yearly",  "price_yearly_placeholder"),
}


def _get_stripe():
    """Lazy-import stripe so the app starts without STRIPE_SECRET_KEY set."""
    import stripe as _stripe
    key = getattr(settings, "stripe_secret_key", "")
    if not key:
        raise HTTPException(status_code=503, detail="Stripe not configured (missing STRIPE_SECRET_KEY).")
    _stripe.api_key = key
    return _stripe


# ── POST /billing/checkout ────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: str = "premium_monthly"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


@router.post("/billing/checkout")
async def create_checkout_session(
    req: CheckoutRequest,
    user_id: str = Depends(verify_user),
):
    """Create a Stripe Checkout session and return the URL."""
    price_id = PLAN_PRICE_IDS.get(req.plan)
    if not price_id or "placeholder" in price_id:
        raise HTTPException(
            status_code=503,
            detail=f"Stripe price ID for '{req.plan}' not configured. Set STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY in .env."
        )

    stripe = _get_stripe()
    frontend_url = getattr(settings, "frontend_base_url", "http://localhost:3000")

    sub = get_latest_subscription(user_id)
    customer_id = sub.get("provider_customer_id") if sub else None

    session_params: dict = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": req.success_url or f"{frontend_url}/dashboard/billing?session_id={{CHECKOUT_SESSION_ID}}&status=success",
        "cancel_url": req.cancel_url or f"{frontend_url}/dashboard/billing?status=cancelled",
        "metadata": {"user_id": user_id, "plan": req.plan},
    }
    if customer_id:
        session_params["customer"] = customer_id

    try:
        session = stripe.checkout.Session.create(**session_params)
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        logger.error(f"Stripe checkout creation failed: {e}")
        raise HTTPException(status_code=500, detail="Could not create checkout session.")


# ── POST /webhooks/stripe ─────────────────────────────────────────────────────

@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
):
    """
    Handle Stripe webhook events.
    Verifies the signature, then updates Firebase subscription + profile records.
    """
    body = await request.body()
    webhook_secret = getattr(settings, "stripe_webhook_secret", "")

    stripe = _get_stripe()

    # Verify signature
    try:
        event = stripe.Webhook.construct_event(body, stripe_signature, webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook signature.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {e}")

    event_type = event["type"]
    data = event["data"]["object"]
    logger.info(f"Stripe webhook: {event_type}")

    if event_type in ("checkout.session.completed",):
        user_id = data.get("metadata", {}).get("user_id")
        plan = data.get("metadata", {}).get("plan", "premium_monthly")
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")

        if user_id:
            existing = get_latest_subscription(user_id)
            if existing:
                update_document("subscriptions", existing["id"], {
                    "plan": "premium",
                    "provider": "stripe",
                    "provider_customer_id": customer_id,
                    "provider_subscription_id": subscription_id,
                    "status": "active",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
            else:
                add_document("subscriptions", {
                    "user_id": user_id,
                    "plan": "premium",
                    "provider": "stripe",
                    "provider_customer_id": customer_id,
                    "provider_subscription_id": subscription_id,
                    "status": "active",
                })

            upsert_profile(user_id, {
                "plan": "premium",
            })

    elif event_type in ("customer.subscription.deleted", "customer.subscription.paused"):
        subscription_id = data.get("id")
        if subscription_id:
            matches = query_documents("subscriptions", filters=[("provider_subscription_id", "==", subscription_id)], limit=1)
            if matches:
                sub = matches[0]
                update_document("subscriptions", sub["id"], {
                    "status": "cancelled",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                if sub.get("user_id"):
                    upsert_profile(sub["user_id"], {"plan": "free"})

    elif event_type == "customer.subscription.updated":
        subscription_id = data.get("id")
        status = data.get("status")
        period_end = data.get("current_period_end")
        if subscription_id:
            matches = query_documents("subscriptions", filters=[("provider_subscription_id", "==", subscription_id)], limit=1)
            if matches:
                update_document("subscriptions", matches[0]["id"], {
                    "status": status,
                    "current_period_end": datetime.fromtimestamp(period_end, tz=timezone.utc).isoformat() if period_end else None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })

    elif event_type in ("invoice.payment_failed",):
        subscription_id = data.get("subscription")
        if subscription_id:
            matches = query_documents("subscriptions", filters=[("provider_subscription_id", "==", subscription_id)], limit=1)
            if matches:
                update_document("subscriptions", matches[0]["id"], {
                    "status": "past_due",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })

    return {"received": True}


# ── GET /billing/subscription ─────────────────────────────────────────────────

@router.get("/billing/subscription")
async def get_subscription(user_id: str = Depends(verify_user)):
    """Get current user's plan and subscription status."""
    plan = get_plan(user_id)
    sub = get_latest_subscription(user_id) or {}

    return {
        "plan": plan,
        "status": sub.get("status", "active" if plan == "free" else "unknown"),
        "provider": sub.get("provider"),
        "current_period_end": sub.get("current_period_end"),
    }


# ── POST /billing/portal ──────────────────────────────────────────────────────

@router.post("/billing/portal")
async def create_portal_session(user_id: str = Depends(verify_user)):
    """Create a Stripe customer portal session so user can manage their subscription."""
    sub = get_latest_subscription(user_id)
    customer_id = sub.get("provider_customer_id") if sub else None

    if not customer_id:
        raise HTTPException(status_code=404, detail="No Stripe customer found for this user.")

    stripe = _get_stripe()
    frontend_url = getattr(settings, "frontend_base_url", "http://localhost:3000")
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{frontend_url}/dashboard/billing",
        )
        return {"portal_url": session.url}
    except Exception as e:
        logger.error(f"Portal session creation failed: {e}")
        raise HTTPException(status_code=500, detail="Could not create billing portal session.")
