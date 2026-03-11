import json
from urllib import error

import pytest

from backend.session.openai_realtime import (
    DEFAULT_OPENAI_REALTIME_MODEL,
    DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
    DEFAULT_OPENAI_REALTIME_VOICE,
    OPENAI_REALTIME_CLIENT_SECRET_TIMEOUT_SECONDS,
    OpenAIRealtimeClientSecretTimeoutError,
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
    assert recorded["timeout"] == OPENAI_REALTIME_CLIENT_SECRET_TIMEOUT_SECONDS
    body = recorded["body"]
    assert body["session"]["model"] == DEFAULT_OPENAI_REALTIME_MODEL
    assert body["session"]["output_modalities"] == ["audio"]
    assert body["session"]["audio"]["output"]["voice"] == DEFAULT_OPENAI_REALTIME_VOICE
    assert body["session"]["instructions"] == "Tutor math clearly."
    assert body["session"]["audio"]["input"]["transcription"]["model"] == DEFAULT_OPENAI_TRANSCRIPTION_MODEL


def test_create_realtime_client_secret_uses_transcription_session_for_transcription_model(monkeypatch) -> None:
    recorded: dict[str, object] = {}

    def _fake_urlopen(req, timeout: int):
        recorded["body"] = json.loads(req.data.decode("utf-8"))
        return _FakeResponse({"client_secret": {"value": "secret-123"}})

    monkeypatch.setenv("OPENAI_API_KEY", "openai-test")
    monkeypatch.setattr("backend.session.openai_realtime.load_local_env", lambda: [".env"])
    monkeypatch.setattr("backend.session.openai_realtime.request.urlopen", _fake_urlopen)

    response = create_realtime_client_secret({
        "model": DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
        "session_type": "transcription",
    })

    assert response == {"client_secret": {"value": "secret-123"}}
    body = recorded["body"]
    assert body["session"]["type"] == "transcription"
    assert body["session"]["audio"]["input"]["format"] == {"type": "audio/pcm", "rate": 24_000}
    assert body["session"]["audio"]["input"]["transcription"]["model"] == DEFAULT_OPENAI_TRANSCRIPTION_MODEL
    assert body["session"]["audio"]["input"]["turn_detection"] is None
    assert "output_modalities" not in body["session"]
    assert "model" not in body["session"]


def test_create_realtime_client_secret_auto_detects_transcription_session_from_model(monkeypatch) -> None:
    recorded: dict[str, object] = {}

    def _fake_urlopen(req, timeout: int):
        recorded["body"] = json.loads(req.data.decode("utf-8"))
        return _FakeResponse({"client_secret": {"value": "secret-123"}})

    monkeypatch.setenv("OPENAI_API_KEY", "openai-test")
    monkeypatch.setattr("backend.session.openai_realtime.load_local_env", lambda: [".env"])
    monkeypatch.setattr("backend.session.openai_realtime.request.urlopen", _fake_urlopen)

    create_realtime_client_secret({"model": DEFAULT_OPENAI_TRANSCRIPTION_MODEL})

    body = recorded["body"]
    assert body["session"]["type"] == "transcription"
    assert body["session"]["audio"]["input"]["transcription"]["model"] == DEFAULT_OPENAI_TRANSCRIPTION_MODEL


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


def test_realtime_client_secret_route_forwards_transcription_session_type(monkeypatch) -> None:
    forwarded: dict[str, object] = {}

    def _fake_create(payload):
        forwarded["payload"] = payload
        return {"client_secret": {"value": "secret-xyz"}}

    monkeypatch.setattr("backend.session.server.create_realtime_client_secret", _fake_create)
    client = TestClient(app)

    response = client.post(
        "/api/realtime/client-secret",
        json={"model": DEFAULT_OPENAI_TRANSCRIPTION_MODEL, "session_type": "transcription"},
    )

    assert response.status_code == 200
    assert response.json() == {"client_secret": {"value": "secret-xyz"}}
    assert forwarded["payload"] == {
        "model": DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
        "session_type": "transcription",
    }


def test_realtime_client_secret_route_maps_missing_api_key_to_503(monkeypatch) -> None:
    monkeypatch.setattr(
        "backend.session.server.create_realtime_client_secret",
        lambda payload: (_ for _ in ()).throw(ValueError("OPENAI_API_KEY is required for OpenAI Realtime")),
    )
    client = TestClient(app)

    response = client.post("/api/realtime/client-secret", json={"model": "gpt-realtime-mini"})

    assert response.status_code == 503
    assert response.json() == {"detail": "OPENAI_API_KEY is required for OpenAI Realtime"}


def test_realtime_client_secret_route_maps_upstream_failure_to_502(monkeypatch) -> None:
    monkeypatch.setattr(
        "backend.session.server.create_realtime_client_secret",
        lambda payload: (_ for _ in ()).throw(RuntimeError("upstream OpenAI failure")),
    )
    client = TestClient(app)

    response = client.post("/api/realtime/client-secret", json={"model": "gpt-realtime-mini"})

    assert response.status_code == 502
    assert response.json() == {"detail": "upstream OpenAI failure"}


def test_realtime_client_secret_route_maps_timeout_to_504(monkeypatch) -> None:
    monkeypatch.setattr(
        "backend.session.server.create_realtime_client_secret",
        lambda payload: (_ for _ in ()).throw(OpenAIRealtimeClientSecretTimeoutError("OpenAI Realtime client secret request timed out")),
    )
    client = TestClient(app)

    response = client.post("/api/realtime/client-secret", json={"model": "gpt-realtime-mini"})

    assert response.status_code == 504
    assert response.json() == {"detail": "OpenAI Realtime client secret request timed out"}


def test_create_realtime_client_secret_raises_runtime_error_for_http_error(monkeypatch) -> None:
    def _fake_urlopen(req, timeout: int):
        raise error.HTTPError(req.full_url, 401, "unauthorized", hdrs=None, fp=_FakeResponse({"error": "bad key"}))

    monkeypatch.setenv("OPENAI_API_KEY", "openai-test")
    monkeypatch.setattr("backend.session.openai_realtime.load_local_env", lambda: [".env"])
    monkeypatch.setattr("backend.session.openai_realtime.request.urlopen", _fake_urlopen)

    with pytest.raises(RuntimeError, match="bad key"):
        create_realtime_client_secret({})


def test_create_realtime_client_secret_raises_timeout_for_url_timeout(monkeypatch) -> None:
    def _fake_urlopen(req, timeout: int):
        raise error.URLError(TimeoutError("timed out"))

    monkeypatch.setenv("OPENAI_API_KEY", "openai-test")
    monkeypatch.setattr("backend.session.openai_realtime.load_local_env", lambda: [".env"])
    monkeypatch.setattr("backend.session.openai_realtime.request.urlopen", _fake_urlopen)

    with pytest.raises(OpenAIRealtimeClientSecretTimeoutError, match="timed out"):
        create_realtime_client_secret({})
