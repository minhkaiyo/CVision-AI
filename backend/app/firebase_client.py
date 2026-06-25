"""Firebase Admin bootstrap helpers."""

from __future__ import annotations

import json

import firebase_admin
from firebase_admin import auth, credentials, firestore, storage

from app.config import settings


def init_firebase():
    """Initialize Firebase Admin exactly once."""
    if firebase_admin._apps:
        return firebase_admin.get_app()

    options: dict[str, str] = {}
    if settings.firebase_storage_bucket:
        options["storageBucket"] = settings.firebase_storage_bucket
    if settings.firebase_project_id:
        options["projectId"] = settings.firebase_project_id

    if settings.firebase_service_account_json:
        cred = credentials.Certificate(json.loads(settings.firebase_service_account_json))
    else:
        cred = credentials.ApplicationDefault()

    return firebase_admin.initialize_app(cred, options or None)


def get_db():
    init_firebase()
    return firestore.client()


def get_auth():
    init_firebase()
    return auth


def get_storage():
    init_firebase()
    return storage.bucket()
