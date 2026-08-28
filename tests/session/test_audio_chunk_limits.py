from __future__ import annotations

import base64
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.session import server


@pytest.fixture(autouse=True)
def isolate_session_runtime(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("NERDY_DISABLE_LIVE_LLM", "1")
    monkeypatch.setenv("NERDY_DISABLE_LIVE_TTS", "1")
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("NERDY_TURN_TRACE_DIR", str(tmp_path / "turn-traces"))


def _session_ws(client: TestClient):
    return client.websocket_connect("/ws/session", headers={"Origin": "http://127.0.0.1:3000"})


def test_session_server_rejects_audio_chunk_above_configured_limit_before_stt_opens(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NERDY_MAX_AUDIO_CHUNK_BYTES", "4")

    class RejectingSTTProvider:
        async def open_session(self, _tracker: object):
            raise AssertionError("oversized audio must be rejected before STT opens")

    monkeypatch.setattr(server, "create_stt_provider", lambda: RejectingSTTProvider())

    client = TestClient(server.app)

    with _session_ws(client) as websocket:
        assert websocket.receive_json()["type"] == "session.started"
        websocket.send_json(
            {
                "type": "audio.chunk",
                "sequence": 1,
                "size": 5,
                "bytes_b64": base64.b64encode(b"12345").decode("ascii"),
            }
        )

        assert websocket.receive_json() == {
            "type": "session.error",
            "detail": "audio chunk exceeds configured 4 byte limit",
        }
