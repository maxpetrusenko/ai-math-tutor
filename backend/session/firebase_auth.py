from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from fastapi import HTTPException

try:
    import firebase_admin
    from firebase_admin import auth, credentials
except ModuleNotFoundError:  # pragma: no cover
    firebase_admin = None
    auth = None
    credentials = None


def firebase_auth_required() -> bool:
    return os.getenv("NERDY_REQUIRE_FIREBASE_AUTH", "0").strip().lower() in {"1", "true", "yes", "on"}


def verify_firebase_bearer_token(authorization: str | None) -> dict[str, Any] | None:
    if not firebase_auth_required():
        return None
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization bearer token")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Invalid Authorization bearer token")

    return verify_firebase_id_token(token.strip())


def verify_firebase_websocket_token(token: str | None) -> dict[str, Any] | None:
    if not firebase_auth_required():
        return None
    if not token:
        raise HTTPException(status_code=401, detail="Missing Firebase auth token")
    return verify_firebase_id_token(token)


def verify_firebase_id_token(token: str) -> dict[str, Any]:
    if auth is None or firebase_admin is None:
        raise HTTPException(status_code=500, detail="firebase-admin not installed")

    _firebase_app()
    try:
        return dict(auth.verify_id_token(token))
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=401, detail=f"Invalid Firebase auth token: {error}") from error


@lru_cache(maxsize=1)
def _firebase_app():
    if firebase_admin is None:
        raise HTTPException(status_code=500, detail="firebase-admin not installed")
    if firebase_admin._apps:
        return firebase_admin.get_app()

    service_account_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if service_account_path:
        return firebase_admin.initialize_app(credentials.Certificate(service_account_path))

    return firebase_admin.initialize_app()
