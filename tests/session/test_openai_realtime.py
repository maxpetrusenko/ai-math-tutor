import json
from urllib import error

import pytest

from backend.session.openai_realtime import (
    DEFAULT_OPENAI_REALTIME_MODEL,
    DEFAULT_OPENAI_REALTIME_VOICE,
    create_realtime_client_secret,
)
from backend.session.server import app
from fastapi.testclient import TestClient


class _FakeResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self._payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")

    def close(self) -> None:
        return None


def test_create_realtime_client_secret_posts_expected_payload(monkeypatch) -> None:
    recorded: dict[str, object] = {}

    def _fake_urlopen(req, timeout: int):
        recorded["timeout"] = timeout
        recorded["url"] = req.full_url
        recorded["headers"] = dict(req.header_items())
        recorded["body"] = json.loads(req.data.decode("utf-8"))
        return _FakeResponse({"client_secret": {"value": "secret-123"}})

    monkeypatch.setenv("OPENAI_API_KEY", "openai-test")
    monkeypatch.setattr("backend.session.openai_realtime.load_local_env", lambda: [".env"])
    monkeypatch.setattr("backend.session.openai_realtime.request.urlopen", _fake_urlopen)

    response = create_realtime_client_secret({"instructions": "Tutor math clearly."})

    assert response == {"client_secret": {"value": "secret-123"}}
    assert recorded["url"] == "https://api.openai.com/v1/realtime/client_secrets"
    assert recorded["timeout"] == 20
    body = recorded["body"]
    assert body["session"]["model"] == DEFAULT_OPENAI_REALTIME_MODEL
    assert body["session"]["audio"]["output"]["voice"] == DEFAULT_OPENAI_REALTIME_VOICE
    assert body["session"]["instructions"] == "Tutor math clearly."
    assert body["session"]["audio"]["input"]["transcription"]["model"] == "gpt-4o-mini-transcribe"


def test_create_realtime_client_secret_requires_api_key(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr("backend.session.openai_realtime.load_local_env", lambda: [])

    with pytest.raises(ValueError, match="OPENAI_API_KEY is required"):
        create_realtime_client_secret({})


def test_realtime_client_secret_route_returns_provider_payload(monkeypatch) -> None:
    monkeypatch.setattr(
        "backend.session.server.create_realtime_client_secret",
        lambda payload: {
            "client_secret": {"value": "secret-xyz"},
            "echo": payload,
        },
    )
    client = TestClient(app)

    response = client.post("/api/realtime/client-secret", json={"model": "gpt-realtime-mini"})

    assert response.status_code == 200
    assert response.json() == {
        "client_secret": {"value": "secret-xyz"},
        "echo": {"model": "gpt-realtime-mini"},
    }


def test_create_realtime_client_secret_raises_runtime_error_for_http_error(monkeypatch) -> None:
    def _fake_urlopen(req, timeout: int):
        raise error.HTTPError(req.full_url, 401, "unauthorized", hdrs=None, fp=_FakeResponse({"error": "bad key"}))

    monkeypatch.setenv("OPENAI_API_KEY", "openai-test")
    monkeypatch.setattr("backend.session.openai_realtime.load_local_env", lambda: [".env"])
    monkeypatch.setattr("backend.session.openai_realtime.request.urlopen", _fake_urlopen)

    with pytest.raises(RuntimeError, match="bad key"):
        create_realtime_client_secret({})
