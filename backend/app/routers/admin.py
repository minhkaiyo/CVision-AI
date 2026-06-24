from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from app.auth import verify_user
from app.supabase_client import get_supabase
import logging

router = APIRouter(tags=["admin"])
logger = logging.getLogger(__name__)


class PlanOverrideRequest(BaseModel):
    plan: str


ALLOWED_PLANS = {"free", "premium", "b2b"}


def _count_table(supabase, table: str, filters: list[tuple[str, str, str]] | None = None) -> int:
    """Return an exact count without fetching table rows."""
    query = supabase.table(table).select("id", count="exact")
    for column, operator, value in filters or []:
        if operator == "eq":
            query = query.eq(column, value)
    res = query.limit(1).execute()
    return int(res.count or 0)


def _sum_successful_payments(supabase) -> int:
    res = (
        supabase.table("payments")
        .select("amount_vnd")
        .in_("status", ["paid", "succeeded", "success", "completed"])
        .execute()
    )
    total = 0
    for row in res.data or []:
        amount = row.get("amount_vnd") or 0
        try:
            total += int(amount)
        except (TypeError, ValueError):
            continue
    return total


def verify_admin(user_id: str = Depends(verify_user)) -> str:
    supabase = get_supabase()
    profile_res = supabase.table("profiles").select("role").eq("id", user_id).execute()
    role = profile_res.data[0]["role"] if profile_res.data else "user"
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_id

@router.get("/admin/metrics")
async def get_dashboard_metrics(admin_id: str = Depends(verify_admin)):
    """Get high level metrics for the admin dashboard."""
    supabase = get_supabase()
    return {
        "total_users": _count_table(supabase, "profiles"),
        "premium_users": _count_table(supabase, "profiles", [("plan", "eq", "premium")]),
        "total_revenue_vnd": _sum_successful_payments(supabase),
        "analyses_count": _count_table(supabase, "analyses"),
    }

@router.get("/admin/users")
async def list_users(admin_id: str = Depends(verify_admin)):
    """List users for admin panel."""
    supabase = get_supabase()
    res = supabase.table("profiles").select("*").order("created_at", desc=True).limit(50).execute()
    return {"users": res.data}

@router.patch("/admin/users/{id}/plan")
async def override_user_plan(
    id: str,
    payload: PlanOverrideRequest,
    admin_id: str = Depends(verify_admin),
):
    """Manually override a user's subscription plan."""
    if payload.plan not in ALLOWED_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan.")

    supabase = get_supabase()
    res = supabase.table("profiles").update({"plan": payload.plan}).eq("id", id).execute()
    supabase.table("admin_audit_logs").insert({
        "admin_user_id": admin_id,
        "action": "override_user_plan",
        "target_type": "profile",
        "target_id": id,
        "metadata": {"plan": payload.plan},
    }).execute()
    return {"status": "success", "updated": res.data}
