"""Tests for the session WebSocket handshake probe in scripts/production_health.py.

The hourly production health probe must not trust a non-empty ``sessionWsUrl``
alone: the session app is a separate host from the frontend, so a green status
string can hide a session WebSocket that cannot complete a handshake at all
(browser sessions would fail while the hourly probe stayed green). These tests
are hermetic: HTTP, WebSocket, and GitHub traffic are all monkeypatched, so they
never touch production hosts.
"""

from __future__ import annotations

from scripts import production_health

FRONTEND = "https://aitutor.maxpetrusenko.com"
SESSION_WS = "wss://aitutor-session.maxpetrusenko.com/ws/session"
REPO = "maxpetrusenko/ai-math-tutor"
TOKEN = "test-token"


def _healthy_status(url: str, *, timeout_seconds: float) -> int:
    assert timeout_seconds == 7
    return 200


def _healthy_json(url: str, *, timeout_seconds: float):
    assert timeout_seconds == 7
    if url == f"{FRONTEND}/api/runtime/status":
        return 200, {"sessionWsUrl": SESSION_WS}
    if url == "https://aitutor-session.maxpetrusenko.com/api/runtime-options":
        return 200, {"defaults": {"llm_provider": "gemini"}, "options": {"llm": {}}}
    raise AssertionError(f"unexpected JSON probe: {url}")


def _recording_probe(events):
    calls = []

    def fake_probe(session_ws_url: str, *, frontend_origin: str, timeout_seconds: float):
        calls.append((session_ws_url, frontend_origin, timeout_seconds))
        return events.pop(0)

    return fake_probe, calls


def test_production_health_probes_advertised_session_websocket(monkeypatch, capsys) -> None:
    monkeypatch.setattr(production_health, "_fetch_status", _healthy_status)
    monkeypatch.setattr(production_health, "_fetch_json", _healthy_json)
    fake_probe, calls = _recording_probe(
        [production_health.CheckResult(name="session-websocket", ok=True, detail="handshake ok")]
    )

    results = production_health.check_endpoints(
        FRONTEND,
        "https://aitutor-session.maxpetrusenko.com",
        timeout_seconds=7,
        session_websocket_probe=fake_probe,
    )

    assert calls == [(SESSION_WS, FRONTEND, 7)]
    websocket_results = [result for result in results if result.name == "session-websocket"]
    assert len(websocket_results) == 1
    assert websocket_results[0].ok is True


def test_production_health_fails_when_session_websocket_handshake_fails(monkeypatch, capsys) -> None:
    monkeypatch.setattr(production_health, "_fetch_status", _healthy_status)
    monkeypatch.setattr(production_health, "_fetch_json", _healthy_json)
    fake_probe, _ = _recording_probe(
        [
            production_health.CheckResult(
                name="session-websocket",
                ok=False,
                detail=f"{SESSION_WS} handshake failed (TimeoutError)",
            )
        ]
    )

    exit_code = production_health.main(
        ["--timeout-seconds", "7"],
        session_websocket_probe=fake_probe,
    )

    assert exit_code == 1
    out = capsys.readouterr().out
    assert "fail session-websocket" in out
    assert "handshake failed" in out


def test_production_health_fails_when_first_websocket_event_is_not_session_started(monkeypatch, capsys) -> None:
    monkeypatch.setattr(production_health, "_fetch_status", _healthy_status)
    monkeypatch.setattr(production_health, "_fetch_json", _healthy_json)
    fake_probe, _ = _recording_probe(
        [
            production_health.CheckResult(
                name="session-websocket",
                ok=False,
                detail=f"{SESSION_WS} first event was 'session.error', expected 'session.started'",
            )
        ]
    )

    exit_code = production_health.main(
        ["--timeout-seconds", "7"],
        session_websocket_probe=fake_probe,
    )

    assert exit_code == 1
    assert "fail session-websocket" in capsys.readouterr().out


def test_production_health_passes_through_when_websocket_probe_ok(monkeypatch, capsys) -> None:
    monkeypatch.setattr(production_health, "_fetch_status", _healthy_status)
    monkeypatch.setattr(production_health, "_fetch_json", _healthy_json)
    fake_probe, _ = _recording_probe(
        [production_health.CheckResult(name="session-websocket", ok=True, detail="ok")]
    )

    exit_code = production_health.main(
        ["--timeout-seconds", "7"],
        session_websocket_probe=fake_probe,
    )

    assert exit_code == 0
    assert "production-health: all 5 checks passed" in capsys.readouterr().out


def test_production_health_derives_websocket_probe_inputs_from_frontend_url(monkeypatch) -> None:
    events = [production_health.CheckResult(name="session-websocket", ok=True, detail="ok")]
    fake_probe, calls = _recording_probe(events)
    monkeypatch.setattr(production_health, "_fetch_status", _healthy_status)
    monkeypatch.setattr(production_health, "_fetch_json", _healthy_json)

    production_health.check_endpoints(
        f"{FRONTEND}/",
        "https://aitutor-session.maxpetrusenko.com",
        timeout_seconds=7,
        session_websocket_probe=fake_probe,
    )

    # The probe must receive the trimmed frontend origin and the runtime-advertised URL.
    assert calls == [(SESSION_WS, FRONTEND, 7)]


def test_production_health_normalizes_frontend_url_to_origin(monkeypatch) -> None:
    """A frontend URL with a path must still produce an origin-only probe header.

    The session server allow-lists exact origins, so passing a URL with a path
    (e.g. https://aitutor.maxpetrusenko.com/app) would send Origin with a path
    and fail a healthy deploy.
    """
    events = [production_health.CheckResult(name="session-websocket", ok=True, detail="ok")]
    fake_probe, calls = _recording_probe(events)
    monkeypatch.setattr(production_health, "_fetch_status", _healthy_status)

    def fake_json(url: str, *, timeout_seconds: float):
        if url.endswith("/api/runtime/status"):
            return 200, {"sessionWsUrl": SESSION_WS}
        if url.endswith("/api/runtime-options"):
            return 200, {"options": {}}
        raise AssertionError(f"unexpected JSON probe: {url}")

    monkeypatch.setattr(production_health, "_fetch_json", fake_json)

    production_health.check_endpoints(
        f"{FRONTEND}/app",
        "https://aitutor-session.maxpetrusenko.com",
        timeout_seconds=7,
        session_websocket_probe=fake_probe,
    )

    assert calls == [(SESSION_WS, FRONTEND, 7)]


def test_production_health_keeps_full_frontend_url_for_http_checks(monkeypatch) -> None:
    """Only the websocket origin is normalized; HTTP checks keep the given prefix."""
    events = [production_health.CheckResult(name="session-websocket", ok=True, detail="ok")]
    fake_probe, calls = _recording_probe(events)
    json_urls: list[str] = []

    def fake_status(url: str, *, timeout_seconds: float) -> int:
        return 200

    def fake_json(url: str, *, timeout_seconds: float):
        json_urls.append(url)
        if url.endswith("/api/runtime/status"):
            return 200, {"sessionWsUrl": SESSION_WS}
        if url.endswith("/api/runtime-options"):
            return 200, {"options": {}}
        raise AssertionError(f"unexpected JSON probe: {url}")

    monkeypatch.setattr(production_health, "_fetch_status", fake_status)
    monkeypatch.setattr(production_health, "_fetch_json", fake_json)

    production_health.check_endpoints(
        f"{FRONTEND}/app",
        "https://aitutor-session.maxpetrusenko.com",
        timeout_seconds=7,
        session_websocket_probe=fake_probe,
    )

    assert json_urls[0] == f"{FRONTEND}/app/api/runtime/status"
    assert calls == [(SESSION_WS, FRONTEND, 7)]


def test_websocket_probe_returns_none_when_no_url_advertised(monkeypatch) -> None:
    assert production_health._probe_session_websocket(None, frontend_origin=FRONTEND, timeout_seconds=7) is None
    assert production_health._probe_session_websocket("", frontend_origin=FRONTEND, timeout_seconds=7) is None


def test_websocket_probe_fails_on_rejected_scheme() -> None:
    result = production_health._probe_session_websocket(
        "https://aitutor-session.maxpetrusenko.com/ws/session",
        frontend_origin=FRONTEND,
        timeout_seconds=7,
    )

    assert result is not None
    assert result.name == "session-websocket"
    assert result.ok is False
    assert "ws://" in result.detail or "wss://" in result.detail


def test_websocket_probe_reports_handshake_exception(monkeypatch) -> None:
    def boom(url: str, *, origin: str, timeout_seconds: float):
        raise TimeoutError("handshake timed out")

    monkeypatch.setattr(production_health, "_fetch_websocket_event", boom)

    result = production_health._probe_session_websocket(
        SESSION_WS, frontend_origin=FRONTEND, timeout_seconds=7
    )

    assert result is not None
    assert result.ok is False
    assert "TimeoutError" in result.detail


def test_websocket_probe_fails_on_unexpected_first_event(monkeypatch) -> None:
    monkeypatch.setattr(
        production_health,
        "_fetch_websocket_event",
        lambda url, *, origin, timeout_seconds: {"type": "session.error"},
    )

    result = production_health._probe_session_websocket(
        SESSION_WS, frontend_origin=FRONTEND, timeout_seconds=7
    )

    assert result is not None
    assert result.ok is False
    assert "session.error" in result.detail


def test_websocket_probe_fails_on_non_json_first_event(monkeypatch) -> None:
    monkeypatch.setattr(
        production_health,
        "_fetch_websocket_event",
        lambda url, *, origin, timeout_seconds: "not-json",
    )

    result = production_health._probe_session_websocket(
        SESSION_WS, frontend_origin=FRONTEND, timeout_seconds=7
    )

    assert result is not None
    assert result.ok is False


def test_websocket_probe_ok_when_session_started(monkeypatch) -> None:
    monkeypatch.setattr(
        production_health,
        "_fetch_websocket_event",
        lambda url, *, origin, timeout_seconds: {"type": "session.started"},
    )

    result = production_health._probe_session_websocket(
        SESSION_WS, frontend_origin=FRONTEND, timeout_seconds=7
    )

    assert result is not None
    assert result.ok is True
    assert SESSION_WS in result.detail


def test_websocket_event_uses_bounded_timeouts_and_frontend_origin(monkeypatch) -> None:
    captured: list[tuple[str, dict]] = []

    class FakeWebSocket:
        def recv(self, timeout=None) -> str:
            captured.append(("recv", {"timeout": timeout}))
            return '{"type": "session.started"}'

        def __enter__(self):
            return self

        def __exit__(self, *args) -> bool:
            return False

    def fake_connect(url: str, **kwargs):
        captured.append(("connect", {"url": url, **kwargs}))
        return FakeWebSocket()

    monkeypatch.setattr(production_health, "websocket_connect", fake_connect)

    event = production_health._fetch_websocket_event(
        SESSION_WS, origin=FRONTEND, timeout_seconds=7
    )

    assert event == {"type": "session.started"}
    connect_kwargs = captured[0][1]
    assert connect_kwargs["url"] == SESSION_WS
    assert connect_kwargs["origin"] == FRONTEND
    assert connect_kwargs["open_timeout"] == 7
    assert captured[1][1]["timeout"] == 7


def test_alert_issue_body_includes_websocket_failure(monkeypatch, capsys) -> None:
    monkeypatch.setattr(production_health, "_fetch_status", lambda url, *, timeout_seconds: 503)
    monkeypatch.setattr(production_health, "_fetch_json", lambda url, *, timeout_seconds: (503, None))
    posts: list[dict] = []

    def fake_github(method: str, path: str, *, token: str, payload=None):
        if method == "GET":
            return 200, []
        if method == "POST" and path == f"/repos/{REPO}/issues":
            posts.append(payload or {})
            return 201, {"number": 7}
        raise AssertionError(f"unexpected GitHub call: {method} {path}")

    monkeypatch.setattr(production_health, "_github_request", fake_github)

    exit_code = production_health.main(
        ["--manage-issue", "--github-repo", REPO, "--github-token", TOKEN]
    )

    assert exit_code == 1
    assert len(posts) == 1
    assert "frontend-root" in str(posts[0].get("body", ""))
