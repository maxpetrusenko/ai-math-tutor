from fastapi.testclient import TestClient
import pytest

from backend.session.server import app


@pytest.fixture(autouse=True)
def disable_live_runtime(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_DISABLE_LIVE_LLM", "1")
    monkeypatch.setenv("NERDY_DISABLE_LIVE_TTS", "1")


def _read_turn_events(websocket) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    while True:
        event = websocket.receive_json()
        events.append(event)
        if event.get("type") == "tts.flush":
            return events


def _committed_reply(events: list[dict[str, object]]) -> str:
    return " ".join(str(event["text"]) for event in events if event.get("type") == "tutor.text.committed").strip()


def test_session_server_treats_clear_math_topic_shift_as_fresh_turn(monkeypatch) -> None:
    captured_calls: list[dict[str, object]] = []

    from backend.session import server

    original_build = server.build_tutor_messages

    def tracking_build_tutor_messages(
        subject: str,
        grade_band: str,
        latest_student_text: str,
        history: list[dict[str, str]],
        student_profile: dict[str, str] | None = None,
    ) -> list[dict[str, str]]:
        captured_calls.append(
            {
                "latest_student_text": latest_student_text,
                "history_length": len(history),
            }
        )
        return original_build(
            subject=subject,
            grade_band=grade_band,
            latest_student_text=latest_student_text,
            history=history,
            student_profile=student_profile,
        )

    monkeypatch.setattr(server, "build_tutor_messages", tracking_build_tutor_messages)
    client = TestClient(app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "I don't understand how to solve for x.",
                "subject": "math",
                "grade_band": "6-8",
            }
        )
        first_events = _read_turn_events(websocket)

        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 2000,
                "text": "1+1",
            }
        )
        second_events = _read_turn_events(websocket)

    first_reply = _committed_reply(first_events)
    second_reply = _committed_reply(second_events)

    assert "x" in first_reply.lower()
    assert captured_calls[0]["history_length"] == 0
    assert captured_calls[1]["history_length"] == 0
    assert "x" not in second_reply.lower()
    assert second_reply == "Let's work on 1+1. What total do you get when you add 1 and 1?"
