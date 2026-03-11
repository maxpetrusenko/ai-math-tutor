import json

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

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
        tts_context_started = websocket.receive_json()
        tutor_chunk = websocket.receive_json()
        first_tts_audio = websocket.receive_json()
        websocket.send_json({"type": "interrupt"})
        trailing_tutor_chunk = websocket.receive_json()
        final_tts_audio = websocket.receive_json()
        tts_flush = websocket.receive_json()
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
    assert tts_context_started["type"] == "tts.context.started"
    assert tutor_chunk["type"] == "tutor.text.committed"
    assert first_tts_audio["type"] == "tts.audio"
    assert trailing_tutor_chunk["type"] == "tutor.text.committed"
    assert final_tts_audio["type"] == "tts.audio"
    assert tts_flush == {"type": "tts.flush", "provider": "cartesia"}
    assert fading["state"] == "fading"
    assert back_to_idle["state"] == "idle"


def test_session_websocket_can_transcribe_without_starting_a_tutor_turn() -> None:
    client = TestClient(app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json({"type": "audio.chunk", "sequence": 1, "size": 320})
        listening = websocket.receive_json()
        audio_ack = websocket.receive_json()
        websocket.send_json({"type": "speech.end", "ts_ms": 1000, "text": "First question", "transcribe_only": True})
        thinking = websocket.receive_json()
        transcript = websocket.receive_json()
        back_to_idle = websocket.receive_json()

    assert listening["state"] == "listening"
    assert audio_ack["type"] == "audio.received"
    assert thinking["state"] == "thinking"
    assert transcript == {"type": "transcript.final", "text": "First question"}
    assert back_to_idle["state"] == "idle"


def test_session_websocket_transcribe_only_accepts_stable_partial_when_final_is_missing(monkeypatch) -> None:
    class _StablePartialOnlySTTSession:
        async def push_audio(self, chunk: bytes, *, ts_ms: float | None = None) -> list[dict[str, str]]:
            return []

        async def finalize(self, *, ts_ms: float) -> list[dict[str, str]]:
            return [{"type": "transcript.partial_stable", "text": "stable partial transcript"}]

        async def close(self) -> None:
            return None

    class _StablePartialOnlySTTProvider:
        async def open_session(self, tracker: object) -> _StablePartialOnlySTTSession:
            return _StablePartialOnlySTTSession()

    monkeypatch.setattr("backend.session.server.create_stt_provider", lambda: _StablePartialOnlySTTProvider())
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
        websocket.receive_json()
        websocket.receive_json()
        websocket.send_json({"type": "speech.end", "ts_ms": 1000, "text": "", "transcribe_only": True})
        thinking = websocket.receive_json()
        partial = websocket.receive_json()
        transcript = websocket.receive_json()
        back_to_idle = websocket.receive_json()

    assert thinking == {"type": "state.changed", "state": "thinking"}
    assert partial == {"type": "transcript.partial_stable", "text": "stable partial transcript"}
    assert transcript == {"type": "transcript.final", "text": "stable partial transcript"}
    assert back_to_idle == {"type": "state.changed", "state": "idle"}


def test_session_websocket_writes_trace_for_transcribe_only_turn(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("NERDY_TURN_TRACE_DIR", str(tmp_path / "turn-traces"))
    client = TestClient(app)

    with client.websocket_connect("/ws/session") as websocket:
        started = websocket.receive_json()
        websocket.send_json({"type": "speech.end", "ts_ms": 1000, "text": "debug this mic release", "transcribe_only": True})
        websocket.receive_json()
        websocket.receive_json()
        websocket.receive_json()

    trace_files = sorted((tmp_path / "turn-traces").glob("*.json"))
    assert len(trace_files) == 1
    trace_payload = json.loads(trace_files[0].read_text())
    assert trace_payload["session_id"] == started["session_id"]
    assert trace_payload["stt"]["source"] == "text_fallback"
    assert trace_payload["stt"]["transcribe_only"] is True
    assert trace_payload["stt"]["transcript_text"] == "debug this mic release"


def test_session_websocket_resets_session_state() -> None:
    client = TestClient(app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json({"type": "speech.end", "ts_ms": 1000, "text": "first question"})
        for _ in range(7):
            websocket.receive_json()

        websocket.send_json({"type": "session.reset"})
        websocket.receive_json()
        websocket.receive_json()
        websocket.receive_json()
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
        "llmModel": "gemini-3-flash-preview",
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


def test_session_websocket_pushes_audio_once_with_chunk_timestamp(monkeypatch) -> None:
    class _RecordingSTTSession:
        def __init__(self) -> None:
            self.push_audio_calls: list[tuple[bytes, float | None]] = []

        async def push_audio(self, chunk: bytes, *, ts_ms: float | None = None) -> list[dict[str, str]]:
            self.push_audio_calls.append((chunk, ts_ms))
            return []

        async def finalize(self, *, ts_ms: float) -> list[dict[str, str]]:
            return []

        async def close(self) -> None:
            return None

    class _RecordingSTTProvider:
        def __init__(self) -> None:
            self.session = _RecordingSTTSession()

        async def open_session(self, tracker: object) -> _RecordingSTTSession:
            return self.session

    provider = _RecordingSTTProvider()
    monkeypatch.setattr("backend.session.server.create_stt_provider", lambda: provider)
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
                "ts_ms": 1234,
            }
        )
        websocket.receive_json()
        websocket.receive_json()

    assert provider.session.push_audio_calls == [(b"abc", 1234.0)]


def test_lessons_api_accepts_local_dev_origin_preflight() -> None:
    client = TestClient(app)

    response = client.options(
        "/api/lessons",
        headers={
            "Origin": "http://127.0.0.1:3012",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3012"


def test_lessons_api_requires_bearer_token_when_firebase_auth_enabled(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_REQUIRE_FIREBASE_AUTH", "1")
    client = TestClient(app)

    response = client.get("/api/lessons")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing Authorization bearer token"}


def test_lessons_api_scopes_fallback_store_per_firebase_uid(monkeypatch) -> None:
    def fake_verify_bearer_token(authorization: str | None) -> dict[str, str]:
        if not authorization:
            raise HTTPException(status_code=401, detail="Missing Authorization bearer token")
        return {"uid": authorization.removeprefix("Bearer ").strip()}

    monkeypatch.setenv("NERDY_REQUIRE_FIREBASE_AUTH", "1")
    monkeypatch.setattr("backend.session.server.verify_firebase_bearer_token", fake_verify_bearer_token)
    client = TestClient(app)
    active_thread = {
        "avatarProviderId": "human-css-2d",
        "conversation": [{"id": "1", "transcript": "What is x?", "tutorText": "Start with the variable."}],
        "gradeBand": "6-8",
        "llmModel": "gemini-3-flash-preview",
        "llmProvider": "gemini",
        "preference": "slow down",
        "sessionId": "lesson-123",
        "studentPrompt": "What is x?",
        "subject": "math",
        "transcript": "What is x?",
        "ttsModel": "sonic-2",
        "ttsProvider": "cartesia",
        "tutorText": "Start with the variable.",
        "version": 1,
    }

    user_a_put = client.put("/api/lessons/active", json=active_thread, headers={"Authorization": "Bearer user-a"})
    user_a_list = client.get("/api/lessons", headers={"Authorization": "Bearer user-a"})
    user_b_list = client.get("/api/lessons", headers={"Authorization": "Bearer user-b"})

    assert user_a_put.status_code == 200
    assert user_a_list.status_code == 200
    assert user_b_list.status_code == 200
    assert user_a_list.json()["activeThread"]["sessionId"] == "lesson-123"
    assert user_b_list.json()["activeThread"] is None


def test_session_websocket_rejects_disallowed_origin(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_ALLOWED_ORIGINS", "https://ai-math-tutor--ai-math-tutor-b39b3.us-east4.hosted.app")
    client = TestClient(app)

    with pytest.raises(WebSocketDisconnect) as error:
        with client.websocket_connect("/ws/session", headers={"Origin": "https://evil.example.com"}):
            pass

    assert error.value.code == 4403
