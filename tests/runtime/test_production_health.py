"""Tests for the scheduled production health probe (scripts/production_health.py).

These tests are hermetic: all HTTP traffic is monkeypatched, so they never touch
production hosts or the GitHub API.
"""

from __future__ import annotations

from scripts import production_health

FRONTEND = "https://aitutor.maxpetrusenko.com"
SESSION = "https://aitutor-session.maxpetrusenko.com"
REPO = "maxpetrusenko/ai-math-tutor"
TOKEN = "test-token"


def _healthy_status(url: str, *, timeout_seconds: float) -> int:
    assert timeout_seconds == 7
    return 200


def _healthy_json(url: str, *, timeout_seconds: float):
    assert timeout_seconds == 7
    if url == f"{FRONTEND}/api/runtime/status":
        return 200, {"sessionWsUrl": "wss://aitutor-session.maxpetrusenko.com/ws/session"}
    if url == f"{SESSION}/api/runtime-options":
        return 200, {"defaults": {"llm_provider": "gemini"}, "options": {"llm": {}}}
    raise AssertionError(f"unexpected JSON probe: {url}")


def test_production_health_passes_when_all_canonical_endpoints_respond(monkeypatch, capsys) -> None:
    status_urls: list[str] = []
    json_urls: list[str] = []

    def fake_status(url: str, *, timeout_seconds: float) -> int:
        status_urls.append(url)
        assert timeout_seconds == 7
        return 200

    def fake_json(url: str, *, timeout_seconds: float):
        json_urls.append(url)
        assert timeout_seconds == 7
        if url == f"{FRONTEND}/api/runtime/status":
            return 200, {"sessionWsUrl": "wss://aitutor-session.maxpetrusenko.com/ws/session"}
        if url == f"{SESSION}/api/runtime-options":
            return 200, {"defaults": {"llm_provider": "gemini"}, "options": {"llm": {}}}
        raise AssertionError(f"unexpected JSON probe: {url}")

    def fail_on_github_call(method: str, path: str, *, token: str, payload=None):
        raise AssertionError(f"unexpected GitHub call without --manage-issue: {method} {path}")

    monkeypatch.setattr(production_health, "_fetch_status", fake_status)
    monkeypatch.setattr(production_health, "_fetch_json", fake_json)
    monkeypatch.setattr(production_health, "_github_request", fail_on_github_call)

    exit_code = production_health.main(["--timeout-seconds", "7"])

    assert exit_code == 0
    assert status_urls == [f"{FRONTEND}/", f"{SESSION}/api/lessons"]
    assert json_urls == [f"{FRONTEND}/api/runtime/status", f"{SESSION}/api/runtime-options"]
    assert "production-health: all 4 checks passed" in capsys.readouterr().out


def test_production_health_fails_when_frontend_proxy_returns_503(monkeypatch, capsys) -> None:
    monkeypatch.setattr(production_health, "_fetch_status", lambda url, *, timeout_seconds: 503)
    monkeypatch.setattr(production_health, "_fetch_json", lambda url, *, timeout_seconds: (503, None))

    exit_code = production_health.main([])

    assert exit_code == 1
    out = capsys.readouterr().out
    assert "fail frontend-root" in out
    assert "503" in out
    assert "checks failed" in out


def test_production_health_fails_when_session_runtime_options_unreachable(monkeypatch, capsys) -> None:
    def fake_status(url: str, *, timeout_seconds: float) -> int:
        return 200 if url == f"{FRONTEND}/" else 0

    def fake_json(url: str, *, timeout_seconds: float):
        if url == f"{FRONTEND}/api/runtime/status":
            return 200, {"sessionWsUrl": "wss://aitutor-session.maxpetrusenko.com/ws/session"}
        return 0, None

    monkeypatch.setattr(production_health, "_fetch_status", fake_status)
    monkeypatch.setattr(production_health, "_fetch_json", fake_json)

    exit_code = production_health.main([])

    assert exit_code == 1
    out = capsys.readouterr().out
    assert "fail session-runtime-options" in out
    assert "did not respond" in out


def test_production_health_fails_when_runtime_status_missing_session_ws_url(monkeypatch, capsys) -> None:
    def fake_json(url: str, *, timeout_seconds: float):
        if url == f"{FRONTEND}/api/runtime/status":
            return 200, {"revision": "sha-test"}
        if url == f"{SESSION}/api/runtime-options":
            return 200, {"options": {}}
        raise AssertionError(f"unexpected JSON probe: {url}")

    monkeypatch.setattr(production_health, "_fetch_status", lambda url, *, timeout_seconds: 200)
    monkeypatch.setattr(production_health, "_fetch_json", fake_json)

    exit_code = production_health.main([])

    assert exit_code == 1
    out = capsys.readouterr().out
    assert "fail frontend-runtime-status" in out
    assert "sessionWsUrl" in out


def test_production_health_accepts_auth_gated_lessons_endpoint(monkeypatch, capsys) -> None:
    def fake_status(url: str, *, timeout_seconds: float) -> int:
        if url == f"{SESSION}/api/lessons":
            return 401
        return 200

    monkeypatch.setattr(production_health, "_fetch_status", fake_status)
    monkeypatch.setattr(production_health, "_fetch_json", _healthy_json)

    exit_code = production_health.main(["--timeout-seconds", "7"])

    assert exit_code == 0
    assert "production-health: all 4 checks passed" in capsys.readouterr().out


def test_production_health_fails_when_lessons_endpoint_errors(monkeypatch, capsys) -> None:
    def fake_status(url: str, *, timeout_seconds: float) -> int:
        if url == f"{SESSION}/api/lessons":
            return 500
        return 200

    monkeypatch.setattr(production_health, "_fetch_status", fake_status)
    monkeypatch.setattr(production_health, "_fetch_json", _healthy_json)

    exit_code = production_health.main(["--timeout-seconds", "7"])

    assert exit_code == 1
    assert "fail session-lessons" in capsys.readouterr().out


def _failing_probe(monkeypatch) -> None:
    monkeypatch.setattr(production_health, "_fetch_status", lambda url, *, timeout_seconds: 503)
    monkeypatch.setattr(production_health, "_fetch_json", lambda url, *, timeout_seconds: (503, None))


def test_production_health_files_alert_issue_once_when_checks_fail(monkeypatch, capsys) -> None:
    _failing_probe(monkeypatch)
    calls: list[tuple[str, str, dict | None]] = []

    def fake_github(method: str, path: str, *, token: str, payload=None):
        calls.append((method, path, payload))
        assert token == TOKEN
        if method == "GET":
            return 200, []
        if method == "POST" and path == f"/repos/{REPO}/issues":
            return 201, {"number": 123}
        raise AssertionError(f"unexpected GitHub call: {method} {path}")

    monkeypatch.setattr(production_health, "_github_request", fake_github)

    exit_code = production_health.main(
        ["--manage-issue", "--github-repo", REPO, "--github-token", TOKEN]
    )

    assert exit_code == 1
    posts = [call for call in calls if call[0] == "POST"]
    assert len(posts) == 1
    create_payload = posts[0][2] or {}
    assert str(create_payload.get("title", "")).startswith("production-health:")
    assert "frontend-root" in str(create_payload.get("body", ""))
    out = capsys.readouterr().out
    assert "fail frontend-root" in out
    assert "filed alert issue #123" in out


def test_production_health_keeps_existing_alert_issue_open(monkeypatch, capsys) -> None:
    _failing_probe(monkeypatch)
    calls: list[tuple[str, str, dict | None]] = []

    def fake_github(method: str, path: str, *, token: str, payload=None):
        calls.append((method, path, payload))
        if method == "GET":
            return 200, [{"number": 42, "title": "production-health: canonical endpoints failing (2026-09-10 12:00 UTC)"}]
        raise AssertionError(f"unexpected GitHub call: {method} {path}")

    monkeypatch.setattr(production_health, "_github_request", fake_github)

    exit_code = production_health.main(
        ["--manage-issue", "--github-repo", REPO, "--github-token", TOKEN]
    )

    assert exit_code == 1
    assert not [call for call in calls if call[0] != "GET"]
    assert "alert issue #42 already open" in capsys.readouterr().out


def test_production_health_closes_alert_issue_after_recovery(monkeypatch, capsys) -> None:
    monkeypatch.setattr(production_health, "_fetch_status", _healthy_status)
    monkeypatch.setattr(production_health, "_fetch_json", _healthy_json)
    calls: list[tuple[str, str, dict | None]] = []

    def fake_github(method: str, path: str, *, token: str, payload=None):
        calls.append((method, path, payload))
        if method == "GET":
            return 200, [{"number": 42, "title": "production-health: canonical endpoints failing (2026-09-10 12:00 UTC)"}]
        if method == "POST" and path == f"/repos/{REPO}/issues/42/comments":
            return 201, {"id": 1}
        if method == "PATCH" and path == f"/repos/{REPO}/issues/42":
            return 200, {"number": 42, "state": "closed"}
        raise AssertionError(f"unexpected GitHub call: {method} {path}")

    monkeypatch.setattr(production_health, "_github_request", fake_github)

    exit_code = production_health.main(
        ["--timeout-seconds", "7", "--manage-issue", "--github-repo", REPO, "--github-token", TOKEN]
    )

    assert exit_code == 0
    methods = [call[0] for call in calls]
    assert methods == ["GET", "POST", "PATCH"]
    assert calls[2][2] == {"state": "closed"}
    assert "closed recovered alert issue #42" in capsys.readouterr().out


def test_production_health_survives_issue_lookup_failures(monkeypatch, capsys) -> None:
    _failing_probe(monkeypatch)
    calls: list[tuple[str, str, dict | None]] = []

    def fake_github(method: str, path: str, *, token: str, payload=None):
        calls.append((method, path, payload))
        return 403, None

    monkeypatch.setattr(production_health, "_github_request", fake_github)

    exit_code = production_health.main(
        ["--manage-issue", "--github-repo", REPO, "--github-token", TOKEN]
    )

    assert exit_code == 1
    assert not [call for call in calls if call[0] != "GET"]
    out = capsys.readouterr().out
    assert "warning" in out
    assert "checks failed" in out


def test_production_health_warns_when_manage_issue_lacks_repo_or_token(monkeypatch, capsys) -> None:
    _failing_probe(monkeypatch)

    def fail_on_github_call(method: str, path: str, *, token: str, payload=None):
        raise AssertionError(f"unexpected GitHub call: {method} {path}")

    monkeypatch.setattr(production_health, "_github_request", fail_on_github_call)
    monkeypatch.delenv("GITHUB_REPOSITORY", raising=False)
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)

    exit_code = production_health.main(["--manage-issue"])

    assert exit_code == 1
    assert "skipping issue update" in capsys.readouterr().out


def test_production_health_ignores_pull_requests_when_deduping(monkeypatch, capsys) -> None:
    _failing_probe(monkeypatch)
    calls: list[tuple[str, str, dict | None]] = []

    def fake_github(method: str, path: str, *, token: str, payload=None):
        calls.append((method, path, payload))
        if method == "GET":
            return 200, [
                {
                    "number": 9,
                    "title": "production-health: canonical endpoints failing (draft)",
                    "pull_request": {"url": "https://api.github.com/repos/maxpetrusenko/ai-math-tutor/pulls/9"},
                }
            ]
        if method == "POST" and path == f"/repos/{REPO}/issues":
            return 201, {"number": 55}
        raise AssertionError(f"unexpected GitHub call: {method} {path}")

    monkeypatch.setattr(production_health, "_github_request", fake_github)

    exit_code = production_health.main(
        ["--manage-issue", "--github-repo", REPO, "--github-token", TOKEN]
    )

    assert exit_code == 1
    assert len([call for call in calls if call[0] == "POST"]) == 1
    assert "filed alert issue #55" in capsys.readouterr().out
