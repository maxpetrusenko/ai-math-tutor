from __future__ import annotations

from scripts import smoke_hosted


class _FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def getcode(self) -> int:
        return 200

    def read(self) -> bytes:
        return b'{"status":"ok"}'


def test_smoke_fetches_json_with_bounded_timeout(monkeypatch) -> None:
    recorded: dict[str, object] = {}

    def fake_urlopen(req, timeout: int):
        recorded["url"] = req.full_url
        recorded["timeout"] = timeout
        return _FakeResponse()

    monkeypatch.setattr(smoke_hosted.request, "urlopen", fake_urlopen)

    status, payload = smoke_hosted._fetch_json("https://example.com/api/runtime/status")

    assert status == 200
    assert payload == {"status": "ok"}
    assert recorded == {
        "url": "https://example.com/api/runtime/status",
        "timeout": smoke_hosted.SMOKE_REQUEST_TIMEOUT_SECONDS,
    }


def test_smoke_fetches_status_with_bounded_timeout(monkeypatch) -> None:
    recorded: dict[str, object] = {}

    def fake_urlopen(req, timeout: int):
        recorded["url"] = req.full_url
        recorded["timeout"] = timeout
        return _FakeResponse()

    monkeypatch.setattr(smoke_hosted.request, "urlopen", fake_urlopen)

    status = smoke_hosted._fetch_status("https://example.com/healthz")

    assert status == 200
    assert recorded == {
        "url": "https://example.com/healthz",
        "timeout": smoke_hosted.SMOKE_REQUEST_TIMEOUT_SECONDS,
    }
