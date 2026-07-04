from __future__ import annotations

from fastapi.testclient import TestClient

from backend.session.server import app


def test_backend_healthz_is_not_cacheable() -> None:
    """Backend /healthz must not be cached by intermediaries.

    Without no-store, CDN/proxy caches may serve a stale "ok" response
    and mask a crashed or restarting backend container.
    """
    client = TestClient(app)

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"service": "session", "status": "ok"}
    # Docker HEALTHCHECK and hosted smoke depend on this returning fresh.
    # intermediaries (Cloud Run proxy, CDN, corporate proxies) must not cache it.
    assert response.headers.get("Cache-Control", "") == "no-store", (
        f"Expected Cache-Control: no-store, got: {response.headers.get('Cache-Control')!r}. "
        "Caching the health check can mask a crashed backend container."
    )
