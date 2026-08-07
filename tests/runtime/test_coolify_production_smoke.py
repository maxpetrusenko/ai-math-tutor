from __future__ import annotations

import time
from pathlib import Path

from scripts import smoke_coolify


def test_coolify_smoke_checks_canonical_frontend_and_session_runtime(monkeypatch, capsys) -> None:
    probed_status_urls: list[str] = []
    probed_json_urls: list[str] = []

    def fake_fetch_status(url: str, *, timeout_seconds: float) -> int:
        probed_status_urls.append(url)
        assert timeout_seconds == 7
        return 200

    def fake_fetch_json(url: str, *, timeout_seconds: float):
        probed_json_urls.append(url)
        assert timeout_seconds == 7
        if url == "https://aitutor.maxpetrusenko.com/api/runtime/status":
            return (
                200,
                {"cache-control": "no-store"},
                {"sessionWsUrl": "wss://aitutor-session.maxpetrusenko.com/ws/session"},
            )
        if url == "https://aitutor-session.maxpetrusenko.com/api/runtime-options":
            return (
                200,
                {},
                {
                    "defaults": {"llm_provider": "gemini"},
                    "options": {"llm": {"gemini": ["gemini-3-flash-preview"]}},
                },
            )
        raise AssertionError(f"unexpected JSON probe: {url}")

    monkeypatch.setattr(smoke_coolify, "_fetch_status", fake_fetch_status)
    monkeypatch.setattr(smoke_coolify, "_fetch_json", fake_fetch_json)

    exit_code = smoke_coolify.main(["--timeout-seconds", "7"])

    assert exit_code == 0
    assert probed_status_urls == ["https://aitutor.maxpetrusenko.com"]
    assert probed_json_urls == [
        "https://aitutor.maxpetrusenko.com/api/runtime/status",
        "https://aitutor-session.maxpetrusenko.com/api/runtime-options",
    ]
    assert "coolify-smoke: ok" in capsys.readouterr().out


def test_coolify_smoke_fails_when_frontend_points_at_wrong_session_host(monkeypatch, capsys) -> None:
    monkeypatch.setattr(smoke_coolify, "_fetch_status", lambda url, *, timeout_seconds: 200)
    monkeypatch.setattr(
        smoke_coolify,
        "_fetch_json",
        lambda url, *, timeout_seconds: (
            200,
            {"cache-control": "no-store"},
            {"sessionWsUrl": "wss://stale-session.example.com/ws/session"},
        ),
    )

    exit_code = smoke_coolify.main([])

    assert exit_code == 1
    assert "does not point at session host" in capsys.readouterr().out


def test_coolify_smoke_fails_when_session_url_is_not_websocket(monkeypatch, capsys) -> None:
    monkeypatch.setattr(smoke_coolify, "_fetch_status", lambda url, *, timeout_seconds: 200)
    monkeypatch.setattr(
        smoke_coolify,
        "_fetch_json",
        lambda url, *, timeout_seconds: (
            200,
            {"cache-control": "no-store"},
            {"sessionWsUrl": "https://aitutor-session.maxpetrusenko.com/ws/session"},
        ),
    )

    exit_code = smoke_coolify.main([])

    assert exit_code == 1
    assert "must use ws or wss" in capsys.readouterr().out


def test_coolify_smoke_requires_secure_websocket_for_https_frontend(monkeypatch, capsys) -> None:
    def fake_fetch_json(url: str, *, timeout_seconds: float):
        if url == "https://aitutor.maxpetrusenko.com/api/runtime/status":
            return (
                200,
                {"cache-control": "no-store"},
                {"sessionWsUrl": "ws://aitutor-session.maxpetrusenko.com/ws/session"},
            )
        if url == "https://aitutor-session.maxpetrusenko.com/api/runtime-options":
            return (
                200,
                {},
                {"defaults": {"llm_provider": "gemini"}, "options": {"llm": {}}},
            )
        raise AssertionError(f"unexpected JSON probe: {url}")

    monkeypatch.setattr(smoke_coolify, "_fetch_status", lambda url, *, timeout_seconds: 200)
    monkeypatch.setattr(smoke_coolify, "_fetch_json", fake_fetch_json)

    exit_code = smoke_coolify.main([])

    assert exit_code == 1
    assert "must use wss when frontend is https" in capsys.readouterr().out


def test_coolify_smoke_requires_session_websocket_path(monkeypatch, capsys) -> None:
    def fake_fetch_json(url: str, *, timeout_seconds: float):
        if url == "https://aitutor.maxpetrusenko.com/api/runtime/status":
            return (
                200,
                {"cache-control": "no-store"},
                {"sessionWsUrl": "wss://aitutor-session.maxpetrusenko.com/ws/not-session"},
            )
        if url == "https://aitutor-session.maxpetrusenko.com/api/runtime-options":
            return (
                200,
                {},
                {"defaults": {"llm_provider": "gemini"}, "options": {"llm": {}}},
            )
        raise AssertionError(f"unexpected JSON probe: {url}")

    monkeypatch.setattr(smoke_coolify, "_fetch_status", lambda url, *, timeout_seconds: 200)
    monkeypatch.setattr(smoke_coolify, "_fetch_json", fake_fetch_json)

    exit_code = smoke_coolify.main([])

    assert exit_code == 1
    assert "must point at /ws/session" in capsys.readouterr().out


def test_coolify_smoke_waits_for_expected_revision_before_passing(monkeypatch, capsys) -> None:
    runtime_payloads = [
        {"sessionWsUrl": "wss://aitutor-session.maxpetrusenko.com/ws/session", "revision": "sha-old"},
        {"sessionWsUrl": "wss://aitutor-session.maxpetrusenko.com/ws/session", "revision": "sha-new"},
    ]
    probed_runtime_revisions: list[str] = []

    def fake_fetch_json(url: str, *, timeout_seconds: float):
        if url == "https://aitutor.maxpetrusenko.com/api/runtime/status":
            payload = runtime_payloads.pop(0)
            probed_runtime_revisions.append(str(payload["revision"]))
            return 200, {"cache-control": "no-store"}, payload
        if url == "https://aitutor-session.maxpetrusenko.com/api/runtime-options":
            return 200, {}, {"defaults": {"llm_provider": "gemini"}, "options": {"llm": {}}}
        raise AssertionError(f"unexpected JSON probe: {url}")

    monkeypatch.setattr(smoke_coolify, "_fetch_status", lambda url, *, timeout_seconds: 200)
    monkeypatch.setattr(smoke_coolify, "_fetch_json", fake_fetch_json)
    monkeypatch.setattr(time, "sleep", lambda seconds: None)

    exit_code = smoke_coolify.main(
        ["--expect-revision", "sha-new", "--wait-seconds", "30", "--poll-interval-seconds", "0.1"]
    )

    assert exit_code == 0
    assert probed_runtime_revisions == ["sha-old", "sha-new"]
    assert "revision='sha-new'" in capsys.readouterr().out


def test_coolify_smoke_retries_transient_frontend_status_before_failing(monkeypatch, capsys) -> None:
    frontend_statuses = [503, 200]
    slept: list[float] = []

    def fake_fetch_status(url: str, *, timeout_seconds: float) -> int:
        return frontend_statuses.pop(0)

    def fake_fetch_json(url: str, *, timeout_seconds: float):
        if url == "https://aitutor.maxpetrusenko.com/api/runtime/status":
            return (
                200,
                {"cache-control": "no-store"},
                {"sessionWsUrl": "wss://aitutor-session.maxpetrusenko.com/ws/session", "revision": "sha-new"},
            )
        if url == "https://aitutor-session.maxpetrusenko.com/api/runtime-options":
            return 200, {}, {"defaults": {"llm_provider": "gemini"}, "options": {"llm": {}}}
        raise AssertionError(f"unexpected JSON probe: {url}")

    monkeypatch.setattr(smoke_coolify, "_fetch_status", fake_fetch_status)
    monkeypatch.setattr(smoke_coolify, "_fetch_json", fake_fetch_json)
    monkeypatch.setattr(time, "sleep", lambda seconds: slept.append(seconds))

    exit_code = smoke_coolify.main(
        ["--expect-revision", "sha-new", "--wait-seconds", "30", "--poll-interval-seconds", "0.1"]
    )

    assert exit_code == 0
    assert slept == [0.1]
    assert "coolify-smoke: ok" in capsys.readouterr().out


def test_coolify_smoke_retries_transient_runtime_status_before_failing(monkeypatch, capsys) -> None:
    runtime_payloads = [
        (503, {}, None),
        (
            200,
            {"cache-control": "no-store"},
            {"sessionWsUrl": "wss://aitutor-session.maxpetrusenko.com/ws/session", "revision": "sha-new"},
        ),
    ]
    slept: list[float] = []

    def fake_fetch_json(url: str, *, timeout_seconds: float):
        if url == "https://aitutor.maxpetrusenko.com/api/runtime/status":
            return runtime_payloads.pop(0)
        if url == "https://aitutor-session.maxpetrusenko.com/api/runtime-options":
            return 200, {}, {"defaults": {"llm_provider": "gemini"}, "options": {"llm": {}}}
        raise AssertionError(f"unexpected JSON probe: {url}")

    monkeypatch.setattr(smoke_coolify, "_fetch_status", lambda url, *, timeout_seconds: 200)
    monkeypatch.setattr(smoke_coolify, "_fetch_json", fake_fetch_json)
    monkeypatch.setattr(time, "sleep", lambda seconds: slept.append(seconds))

    exit_code = smoke_coolify.main(
        ["--expect-revision", "sha-new", "--wait-seconds", "30", "--poll-interval-seconds", "0.1"]
    )

    assert exit_code == 0
    assert slept == [0.1]
    assert "coolify-smoke: ok" in capsys.readouterr().out


def test_fast_coolify_deploy_runs_post_deploy_smoke() -> None:
    workflow = Path(".github/workflows/fast-coolify-deploy.yml").read_text(encoding="utf-8")

    assert "smoke-production:" in workflow
    assert "needs:\n      - deploy" in workflow
    assert "Skip smoke when SSH secret is absent" in workflow
    assert "if: ${{ env.COOLIFY_SSH_PRIVATE_KEY != '' }}" in workflow
    assert "DOCKER_TAG: ${{ env.DOCKER_TAG }}" in workflow
    assert "python3 scripts/smoke_coolify.py" in workflow
    assert '--expect-revision "$DOCKER_TAG"' in workflow


def test_frontend_dockerfile_stamps_app_revision_for_runtime_smoke() -> None:
    dockerfile = Path("frontend/Dockerfile").read_text(encoding="utf-8")

    assert "ARG APP_REVISION" in dockerfile
    assert "ENV APP_REVISION=$APP_REVISION" in dockerfile

