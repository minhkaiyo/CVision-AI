"""Authentication and usage-limit helpers."""

import logging
from datetime import date
from typing import Optional

from fastapi import Depends, Header, HTTPException

from app.config import settings
from app.firebase_client import get_auth
from app.firebase_store import count_usage_today, get_plan, log_usage_event

logger = logging.getLogger(__name__)


async def verify_user(authorization: Optional[str] = Header(None)) -> str:
    """Verify a Firebase ID token and return the user's UID."""
    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        if token:
            try:
                decoded = get_auth().verify_id_token(token)
                uid = decoded.get("uid")
                if uid:
                    return uid
                raise HTTPException(status_code=401, detail="Invalid or expired token.")
            except HTTPException:
                raise
            except Exception as exc:
                logger.warning("Firebase token verification failed: %s", exc)
                raise HTTPException(status_code=401, detail="Token verification failed.")

    if getattr(settings, "app_env", "development") == "production":
        raise HTTPException(status_code=401, detail="Authorization header required.")

    logger.debug("No auth token - using mock user ID (dev mode only)")
    return "dev-user"


async def check_usage_limit(user_id: str = Depends(verify_user)) -> bool:
    """Enforce per-plan usage limits."""
    plan = get_plan(user_id)
    if plan in ("premium", "b2b"):
        return True

    today = date.today().isoformat()
    count = count_usage_today(user_id, "analysis", today)
    if count >= 1:
        raise HTTPException(
            status_code=403,
            detail="Free tier limit: 1 analysis per day. Upgrade to Premium for unlimited access.",
        )
    return True


def log_usage(user_id: str, action: str, metadata: dict = {}) -> None:
    """Fire-and-forget usage log. Never raises."""
    try:
        log_usage_event(user_id, action, metadata)
    except Exception as exc:
        logger.warning("Usage log failed (non-critical): %s", exc)
