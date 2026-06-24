from __future__ import annotations

import io
from email.message import Message
from urllib import error

from scripts import smoke_hosted


def test_fetch_status_returns_http_error_code(monkeypatch) -> None:
    def fake_urlopen(*_args, **_kwargs):
        raise error.HTTPError(
            url="https://session.example.com/healthz",
            code=404,
            msg="Not Found",
            hdrs=Message(),
            fp=io.BytesIO(b"not found"),
        )

    monkeypatch.setattr(smoke_hosted.request, "urlopen", fake_urlopen)

    assert smoke_hosted._fetch_status("https://session.example.com/healthz") == 404


def test_smoke_checks_frontend_and_backend_healthz_before_auth_probe(monkeypatch) -> None:
    probed_status_urls: list[str] = []
    probed_json_urls: list[str] = []

    def fake_fetch_status(url: str) -> int:
        probed_status_urls.append(url)
        return 200

    def fake_fetch_json(url: str):
        probed_json_urls.append(url)
        if url.endswith("/api/runtime/status"):
            return 200, {
                "firebaseConfigReady": True,
                "revision": "rev-123",
                "service": "ai-math-tutor-frontend",
                "sessionWsUrl": "wss://session.example.com/ws/session",
            }
        if url.endswith("/api/lessons"):
            return 401, {"detail": "Not authenticated"}
        raise AssertionError(f"unexpected JSON probe: {url}")

    monkeypatch.setattr(smoke_hosted, "_fetch_status", fake_fetch_status)
    monkeypatch.setattr(smoke_hosted, "_fetch_json", fake_fetch_json)

    exit_code = smoke_hosted.main(
        [
            "--frontend-url",
            "https://aitutor.maxpetrusenko.com/",
            "--expect-auth",
            "--expect-firebase",
        ]
    )

    assert exit_code == 0
    assert probed_status_urls == [
        "https://aitutor.maxpetrusenko.com/healthz",
        "https://session.example.com/healthz",
    ]
    assert probed_json_urls == [
        "https://aitutor.maxpetrusenko.com/api/runtime/status",
        "https://session.example.com/api/lessons",
    ]
