from fastapi.testclient import TestClient

from backend.session.server import app


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
