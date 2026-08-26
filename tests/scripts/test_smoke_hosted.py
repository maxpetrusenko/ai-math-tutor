from __future__ import annotations

from scripts import smoke_hosted


def test_smoke_fails_when_frontend_session_target_does_not_match_backend(monkeypatch, capsys) -> None:
    def fake_fetch_status(url: str) -> int:
        assert url == "https://aitutor.maxpetrusenko.com"
        return 200

    def fake_fetch_json(url: str):
        if url == "https://aitutor.maxpetrusenko.com/api/runtime/status":
            return 200, {
                "revision": "sha-example",
                "service": "ai-math-tutor-web",
                "sessionWsUrl": "wss://staging-session.example.com/ws/session",
            }
        if url == "https://aitutor-session.maxpetrusenko.com/api/lessons":
            return 200, {"activeThread": None, "archive": []}
        raise AssertionError(f"unexpected fetch: {url}")

    monkeypatch.setattr(smoke_hosted, "_fetch_status", fake_fetch_status)
    monkeypatch.setattr(smoke_hosted, "_fetch_json", fake_fetch_json)

    result = smoke_hosted.main(
        [
            "--frontend-url",
            "https://aitutor.maxpetrusenko.com",
            "--backend-url",
            "https://aitutor-session.maxpetrusenko.com/api/lessons",
        ]
    )

    assert result == 1
    assert "sessionWsUrl" in capsys.readouterr().out


def test_smoke_passes_when_frontend_session_target_matches_backend(monkeypatch) -> None:
    def fake_fetch_status(url: str) -> int:
        assert url == "https://aitutor.maxpetrusenko.com"
        return 200

    def fake_fetch_json(url: str):
        if url == "https://aitutor.maxpetrusenko.com/api/runtime/status":
            return 200, {
                "revision": "sha-example",
                "service": "ai-math-tutor-web",
                "sessionWsUrl": "wss://aitutor-session.maxpetrusenko.com/ws/session",
            }
        if url == "https://aitutor-session.maxpetrusenko.com/api/lessons":
            return 200, {"activeThread": None, "archive": []}
        raise AssertionError(f"unexpected fetch: {url}")

    monkeypatch.setattr(smoke_hosted, "_fetch_status", fake_fetch_status)
    monkeypatch.setattr(smoke_hosted, "_fetch_json", fake_fetch_json)

    result = smoke_hosted.main(
        [
            "--frontend-url",
            "https://aitutor.maxpetrusenko.com",
            "--backend-url",
            "https://aitutor-session.maxpetrusenko.com/api/lessons",
        ]
    )

    assert result == 0
