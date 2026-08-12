from __future__ import annotations

from urllib import error

from scripts import smoke_hosted


class _FakeResponse:
    def __init__(self, payload: str, status: int = 200) -> None:
        self._payload = payload
        self._status = status

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def getcode(self) -> int:
        return self._status

    def read(self) -> bytes:
        return self._payload.encode("utf-8")


class _FakeHttpError(error.HTTPError):
    def __init__(self, payload: str, status: int = 404) -> None:
        super().__init__("https://example.com/health", status, "not found", hdrs=None, fp=None)
        self._payload = payload

    def read(self) -> bytes:
        return self._payload.encode("utf-8")


def test_fetch_json_treats_non_json_success_body_as_missing_payload(monkeypatch) -> None:
    monkeypatch.setattr(smoke_hosted.request, "urlopen", lambda req: _FakeResponse("not json", 200))

    status, payload = smoke_hosted._fetch_json("https://example.com/api/runtime/status")

    assert status == 200
    assert payload is None


def test_fetch_json_treats_non_json_http_error_body_as_missing_payload(monkeypatch) -> None:
    def fake_urlopen(req):
        raise _FakeHttpError("404 page not found", 404)

    monkeypatch.setattr(smoke_hosted.request, "urlopen", fake_urlopen)

    status, payload = smoke_hosted._fetch_json("https://example.com/health")

    assert status == 404
    assert payload is None
