from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException

from app.auth import verify_user
from app.firebase_store import (
    count_documents,
    get_role,
    log_usage_event,
    query_documents,
    upsert_profile,
)

router = APIRouter(tags=["admin"])


class PlanOverrideRequest(BaseModel):
    plan: str


ALLOWED_PLANS = {"free", "premium", "b2b"}


def _sum_successful_payments() -> int:
    payments = query_documents(
        "payments",
        filters=[("status", "in", ["paid", "succeeded", "success", "completed"])],
    )
    total = 0
    for row in payments:
        amount = row.get("amount_vnd") or 0
        try:
            total += int(amount)
        except (TypeError, ValueError):
            continue
    return total


def verify_admin(user_id: str = Depends(verify_user)) -> str:
    if get_role(user_id) != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_id


@router.get("/admin/metrics")
async def get_dashboard_metrics(admin_id: str = Depends(verify_admin)):
    return {
        "total_users": count_documents("profiles"),
        "premium_users": count_documents("profiles", filters=[("plan", "==", "premium")]),
        "total_revenue_vnd": _sum_successful_payments(),
        "analyses_count": count_documents("analyses"),
    }


@router.get("/admin/users")
async def list_users(admin_id: str = Depends(verify_admin)):
    users = query_documents("profiles", order_by="created_at", descending=True, limit=50)
    return {"users": users}


@router.patch("/admin/users/{id}/plan")
async def override_user_plan(
    id: str,
    payload: PlanOverrideRequest,
    admin_id: str = Depends(verify_admin),
):
    if payload.plan not in ALLOWED_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan.")

    updated = upsert_profile(id, {"plan": payload.plan})
    log_usage_event(
        admin_id,
        "override_user_plan",
        {"target_type": "profile", "target_id": id, "plan": payload.plan},
    )
    return {"status": "success", "updated": updated}
