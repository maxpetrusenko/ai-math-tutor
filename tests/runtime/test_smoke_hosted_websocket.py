from __future__ import annotations

import importlib.util
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SMOKE_SCRIPT = REPO_ROOT / "scripts" / "smoke_hosted.py"


def _load_smoke_hosted():
    spec = importlib.util.spec_from_file_location("smoke_hosted", SMOKE_SCRIPT)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_smoke_opens_advertised_session_websocket_before_passing(monkeypatch) -> None:
    smoke_hosted = _load_smoke_hosted()
    websocket_calls: list[tuple[str, str, float]] = []

    def fake_fetch_status(url: str) -> int:
        assert url == "https://aitutor.maxpetrusenko.com"
        return 200

    def fake_fetch_json(url: str):
        if url == "https://aitutor.maxpetrusenko.com/api/runtime/status":
            return 200, {
                "revision": "sha-test",
                "service": "ai-math-tutor-web",
                "sessionWsUrl": "wss://aitutor-session.maxpetrusenko.com/ws/session",
            }
        if url == "https://aitutor-session.maxpetrusenko.com/api/lessons":
            return 200, {"activeThread": None, "archive": []}
        raise AssertionError(f"unexpected JSON fetch: {url}")

    def fake_fetch_websocket_event(url: str, *, origin: str, timeout_seconds: float):
        websocket_calls.append((url, origin, timeout_seconds))
        return {"type": "session.started", "session_id": "smoke"}

    monkeypatch.setattr(smoke_hosted, "_fetch_status", fake_fetch_status)
    monkeypatch.setattr(smoke_hosted, "_fetch_json", fake_fetch_json)
    monkeypatch.setattr(smoke_hosted, "_fetch_websocket_event", fake_fetch_websocket_event, raising=False)

    result = smoke_hosted.main(
        [
            "--frontend-url",
            "https://aitutor.maxpetrusenko.com",
            "--backend-url",
            "https://aitutor-session.maxpetrusenko.com/api/lessons",
        ]
    )

    assert result == 0
    assert websocket_calls == [
        (
            "wss://aitutor-session.maxpetrusenko.com/ws/session",
            "https://aitutor.maxpetrusenko.com",
            10.0,
        )
    ]


def test_smoke_fails_when_runtime_status_has_no_session_websocket(monkeypatch, capsys) -> None:
    smoke_hosted = _load_smoke_hosted()

    monkeypatch.setattr(smoke_hosted, "_fetch_status", lambda _url: 200)

    def fake_fetch_json(url: str):
        if url == "https://aitutor.maxpetrusenko.com/api/runtime/status":
            return 200, {"revision": "sha-test", "service": "ai-math-tutor-web", "sessionWsUrl": None}
        if url == "https://aitutor-session.maxpetrusenko.com/api/lessons":
            return 200, {"activeThread": None, "archive": []}
        raise AssertionError(f"unexpected JSON fetch: {url}")

    monkeypatch.setattr(smoke_hosted, "_fetch_json", fake_fetch_json)
    monkeypatch.setattr(
        smoke_hosted,
        "_fetch_websocket_event",
        lambda *_args, **_kwargs: {"type": "session.started", "session_id": "smoke"},
        raising=False,
    )

    result = smoke_hosted.main(
        [
            "--frontend-url",
            "https://aitutor.maxpetrusenko.com",
            "--backend-url",
            "https://aitutor-session.maxpetrusenko.com/api/lessons",
        ]
    )

    assert result == 1
    assert "could not determine session websocket url" in capsys.readouterr().out


def test_smoke_fails_when_session_websocket_first_event_is_unexpected(monkeypatch, capsys) -> None:
    smoke_hosted = _load_smoke_hosted()

    monkeypatch.setattr(smoke_hosted, "_fetch_status", lambda _url: 200)

    def fake_fetch_json(url: str):
        if url == "https://aitutor.maxpetrusenko.com/api/runtime/status":
            return 200, {
                "revision": "sha-test",
                "service": "ai-math-tutor-web",
                "sessionWsUrl": "wss://aitutor-session.maxpetrusenko.com/ws/session",
            }
        if url == "https://aitutor-session.maxpetrusenko.com/api/lessons":
            return 200, {"activeThread": None, "archive": []}
        raise AssertionError(f"unexpected JSON fetch: {url}")

    monkeypatch.setattr(smoke_hosted, "_fetch_json", fake_fetch_json)
    monkeypatch.setattr(
        smoke_hosted,
        "_fetch_websocket_event",
        lambda *_args, **_kwargs: {"type": "session.error", "detail": "not ready"},
        raising=False,
    )

    result = smoke_hosted.main(
        [
            "--frontend-url",
            "https://aitutor.maxpetrusenko.com",
            "--backend-url",
            "https://aitutor-session.maxpetrusenko.com/api/lessons",
        ]
    )

    assert result == 1
    assert "unexpected session websocket first event" in capsys.readouterr().out
