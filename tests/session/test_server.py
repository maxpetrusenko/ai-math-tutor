import pytest
from fastapi.testclient import TestClient

from backend.session.server import app


@pytest.fixture(autouse=True)
def disable_live_runtime(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("NERDY_DISABLE_LIVE_LLM", "1")
    monkeypatch.setenv("NERDY_DISABLE_LIVE_TTS", "1")
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))


def test_session_websocket_streams_state_and_tutor_events() -> None:
    client = TestClient(app)

    with client.websocket_connect("/ws/session") as websocket:
        started = websocket.receive_json()
        websocket.send_json({"type": "audio.chunk", "sequence": 1, "size": 320})
        listening = websocket.receive_json()
        audio_ack = websocket.receive_json()
        websocket.send_json({"type": "speech.end", "ts_ms": 1000, "text": "First question"})
        thinking = websocket.receive_json()
        transcript = websocket.receive_json()
        speaking = websocket.receive_json()
        tutor_started = websocket.receive_json()
        websocket.receive_json()
        websocket.receive_json()
        websocket.receive_json()
        websocket.send_json({"type": "interrupt"})
        websocket.receive_json()
        fading = websocket.receive_json()
        back_to_idle = websocket.receive_json()

    assert started == {
        "type": "session.started",
        "session_id": started["session_id"],
        "state": "idle",
    }
    assert listening["state"] == "listening"
    assert audio_ack["type"] == "audio.received"
    assert thinking["state"] == "thinking"
    assert transcript == {"type": "transcript.final", "text": "First question"}
    assert speaking["state"] == "speaking"
    assert tutor_started["type"] == "tutor.turn.started"
    assert fading["state"] == "fading"
    assert back_to_idle["state"] == "idle"


def test_session_websocket_resets_session_state() -> None:
    client = TestClient(app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json({"type": "speech.end", "ts_ms": 1000, "text": "first question"})
        for _ in range(8):
            websocket.receive_json()

        websocket.send_json({"type": "session.reset"})
        reset_event = websocket.receive_json()

    assert reset_event == {"type": "session.reset", "state": "idle"}


def test_session_websocket_restores_existing_session_by_id() -> None:
    client = TestClient(app)

    with client.websocket_connect("/ws/session?session_id=lesson-1") as websocket:
        started = websocket.receive_json()
        websocket.send_json(
            {
                "type": "session.restore",
                "subject": "science",
                "grade_band": "9-10",
                "student_profile": {"preference": "use examples"},
                "history": [
                    {"role": "user", "content": "What is gravity?"},
                    {"role": "assistant", "content": "What do you notice when objects fall?"},
                ],
            }
        )
        restored = websocket.receive_json()

    with client.websocket_connect("/ws/session?session_id=lesson-1") as websocket:
        reopened = websocket.receive_json()

    assert started["session_id"] == "lesson-1"
    assert restored == {
        "type": "session.restored",
        "history_length": 2,
        "session_id": "lesson-1",
        "state": "idle",
    }
    assert reopened == {
        "type": "session.started",
        "session_id": "lesson-1",
        "state": "idle",
    }


def test_lesson_history_api_persists_active_and_archived_threads() -> None:
    client = TestClient(app)
    active_thread = {
        "avatarProviderId": "human-css-2d",
        "conversation": [{"id": "1", "transcript": "What is x?", "tutorText": "What do you know already?"}],
        "gradeBand": "6-8",
        "llmModel": "gemini-2.5-flash",
        "llmProvider": "gemini",
        "preference": "slow down",
        "sessionId": "lesson-123",
        "studentPrompt": "What is x?",
        "subject": "math",
        "transcript": "What is x?",
        "ttsModel": "sonic-2",
        "ttsProvider": "cartesia",
        "tutorText": "What do you know already?",
        "version": 1,
    }
    archive_entry = {
        "gradeBand": "6-8",
        "id": "archive-1",
        "subject": "math",
        "thread": active_thread,
        "title": "What is x?",
        "turnCount": 1,
        "updatedAt": "2026-03-10T00:00:00.000Z",
    }

    put_response = client.put("/api/lessons/active", json=active_thread)
    archive_response = client.post("/api/lessons/archive", json=archive_entry)
    list_response = client.get("/api/lessons")
    thread_response = client.get("/api/lessons/archive/archive-1")
    clear_response = client.delete("/api/lessons/active")

    assert put_response.status_code == 200
    assert archive_response.status_code == 200
    assert list_response.status_code == 200
    assert thread_response.status_code == 200
    assert clear_response.status_code == 200
    assert list_response.json()["activeThread"]["sessionId"] == "lesson-123"
    assert list_response.json()["archive"][0]["id"] == "archive-1"
    assert thread_response.json()["sessionId"] == "lesson-123"
    assert clear_response.json()["activeThread"] is None


def test_session_websocket_surfaces_provider_errors_before_close(monkeypatch) -> None:
    class _ExplodingSTTSession:
        async def push_audio(self, chunk: bytes, *, ts_ms: float | None = None) -> list[dict[str, str]]:
            raise RuntimeError("deepgram connection closed: code=1008 reason=unsupported audio")

        async def finalize(self, *, ts_ms: float) -> list[dict[str, str]]:
            return []

        async def close(self) -> None:
            return None

    class _ExplodingSTTProvider:
        async def open_session(self, tracker: object) -> _ExplodingSTTSession:
            return _ExplodingSTTSession()

    monkeypatch.setattr("backend.session.server.create_stt_provider", lambda: _ExplodingSTTProvider())
    client = TestClient(app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "audio.chunk",
                "sequence": 1,
                "size": 320,
                "bytes_b64": "YWJj",
                "mime_type": "audio/webm;codecs=opus",
            }
        )
        error_event = websocket.receive_json()

    assert error_event["type"] == "session.error"
    assert "unsupported audio" in error_event["detail"]
