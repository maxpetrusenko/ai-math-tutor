import pytest
from fastapi.testclient import TestClient

from backend.session.server import app


@pytest.fixture(autouse=True)
def disable_live_runtime(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_DISABLE_LIVE_LLM", "1")
    monkeypatch.setenv("NERDY_DISABLE_LIVE_TTS", "1")


def test_session_websocket_streams_state_and_tutor_events() -> None:
    client = TestClient(app)

    with client.websocket_connect("/ws/session") as websocket:
        started = websocket.receive_json()
        websocket.send_json({"type": "audio.chunk", "sequence": 1, "size": 320})
        listening = websocket.receive_json()
        audio_ack = websocket.receive_json()
        websocket.send_json({"type": "speech.end", "ts_ms": 1000})
        thinking = websocket.receive_json()
        websocket.send_json({"type": "tutor.turn.start", "turn_id": "turn-1"})
        speaking = websocket.receive_json()
        tutor_started = websocket.receive_json()
        websocket.send_json({"type": "interrupt"})
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
