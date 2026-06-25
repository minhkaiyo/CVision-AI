"""Lightweight Firestore data helpers for product collections."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from google.cloud.firestore_v1.base_query import FieldFilter

from app.firebase_client import get_db


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_snapshot(snapshot) -> dict[str, Any] | None:
    if not snapshot.exists:
        return None
    data = snapshot.to_dict() or {}
    data.setdefault("id", snapshot.id)
    return data


def get_document(collection: str, doc_id: str) -> dict[str, Any] | None:
    snapshot = get_db().collection(collection).document(doc_id).get()
    return _normalize_snapshot(snapshot)


def set_document(collection: str, doc_id: str, payload: dict[str, Any], merge: bool = True) -> dict[str, Any]:
    data = {"id": doc_id, **payload}
    ref = get_db().collection(collection).document(doc_id)
    ref.set(data, merge=merge)
    return {"id": doc_id, **data}


def update_document(collection: str, doc_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    ref = get_db().collection(collection).document(doc_id)
    ref.set(payload, merge=True)
    snapshot = ref.get()
    return _normalize_snapshot(snapshot) or {"id": doc_id, **payload}


def add_document(collection: str, payload: dict[str, Any], doc_id: str | None = None) -> dict[str, Any]:
    ref = get_db().collection(collection).document(doc_id) if doc_id else get_db().collection(collection).document()
    data = {
        "id": ref.id,
        "created_at": payload.get("created_at") or _now_iso(),
        "updated_at": payload.get("updated_at") or _now_iso(),
        **payload,
    }
    ref.set(data)
    return data


def delete_document(collection: str, doc_id: str) -> None:
    get_db().collection(collection).document(doc_id).delete()


def query_documents(
    collection: str,
    filters: list[tuple[str, str, Any]] | None = None,
    order_by: str | None = None,
    descending: bool = False,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    query = get_db().collection(collection)
    for field, operator, value in filters or []:
        query = query.where(filter=FieldFilter(field, operator, value))
    if order_by:
        direction = "DESCENDING" if descending else "ASCENDING"
        query = query.order_by(order_by, direction=direction)
    if limit:
        query = query.limit(limit)
    return [_normalize_snapshot(doc) for doc in query.stream() if _normalize_snapshot(doc)]


def count_documents(collection: str, filters: list[tuple[str, str, Any]] | None = None) -> int:
    return len(query_documents(collection, filters=filters))


def get_profile(user_id: str) -> dict[str, Any] | None:
    return get_document("profiles", user_id)


def upsert_profile(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    existing = get_profile(user_id) or {}
    data = {
        "created_at": existing.get("created_at") or _now_iso(),
        "updated_at": _now_iso(),
        **existing,
        **payload,
    }
    return set_document("profiles", user_id, data, merge=False)


def get_plan(user_id: str) -> str:
    profile = get_profile(user_id) or {}
    return str(profile.get("plan") or "free")


def get_role(user_id: str) -> str:
    profile = get_profile(user_id) or {}
    return str(profile.get("role") or "user")


def count_usage_today(user_id: str, action: str, day_iso: str) -> int:
    return count_documents(
        "usage_logs",
        filters=[
            ("user_id", "==", user_id),
            ("action", "==", action),
            ("created_date", "==", day_iso),
        ],
    )


def log_usage_event(user_id: str, action: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    today = datetime.now(timezone.utc).date().isoformat()
    return add_document(
        "usage_logs",
        {
            "user_id": user_id,
            "action": action,
            "metadata": metadata or {},
            "created_date": today,
        },
    )


def get_latest_subscription(user_id: str) -> dict[str, Any] | None:
    subs = query_documents(
        "subscriptions",
        filters=[("user_id", "==", user_id)],
        order_by="created_at",
        descending=True,
        limit=1,
    )
    return subs[0] if subs else None
