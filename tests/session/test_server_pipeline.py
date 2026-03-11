import base64
import json
from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from backend.session import server


class _FakeSTTSession:
    def __init__(self, final_text: str) -> None:
        self.final_text = final_text
        self.audio_payloads: list[bytes] = []
        self.closed = False

    async def push_audio(self, chunk: bytes, *, ts_ms: float | None = None) -> list[dict[str, str]]:
        self.audio_payloads.append(chunk)
        return []

    async def finalize(self, *, ts_ms: float) -> list[dict[str, str]]:
        return [{"type": "transcript.final", "text": self.final_text}]

    async def close(self) -> None:
        self.closed = True


class _FakeSTTProvider:
    def __init__(self, session: _FakeSTTSession) -> None:
        self.session = session

    async def open_session(self, tracker: object) -> _FakeSTTSession:
        return self.session


@pytest.fixture(autouse=True)
def disable_live_runtime(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("NERDY_DISABLE_LIVE_LLM", "1")
    monkeypatch.setenv("NERDY_DISABLE_LIVE_TTS", "1")
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("NERDY_TURN_TRACE_DIR", str(tmp_path / "turn-traces"))


def test_session_server_streams_transcript_tutor_text_and_tts_audio(monkeypatch) -> None:
    fake_session = _FakeSTTSession(final_text="heard from audio")
    monkeypatch.setattr(server, "create_stt_provider", lambda: _FakeSTTProvider(fake_session))
    client = TestClient(server.app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "audio.chunk",
                "sequence": 1,
                "size": 320,
                "bytes_b64": base64.b64encode(b"real-audio").decode("ascii"),
            }
        )
        websocket.receive_json()
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "fallback text should not win",
                "subject": "math",
                "grade_band": "6-8",
            }
        )

        thinking = websocket.receive_json()
        transcript = websocket.receive_json()
        speaking = websocket.receive_json()
        turn_started = websocket.receive_json()
        tts_context = websocket.receive_json()
        committed_text = websocket.receive_json()
        tts_audio = websocket.receive_json()
        tts_flush = websocket.receive_json()

    assert thinking["state"] == "thinking"
    assert transcript["type"] == "transcript.final"
    assert transcript["text"] == "heard from audio"
    assert transcript["text"] != "fallback text should not win"
    assert speaking["state"] == "speaking"
    assert turn_started["type"] == "tutor.turn.started"
    assert tts_context["type"] == "tts.context.started"
    assert committed_text["type"] == "tutor.text.committed"
    assert tts_audio["type"] == "tts.audio"
    assert tts_audio["timestamps"]
    assert tts_flush["type"] == "tts.flush"
    assert fake_session.audio_payloads == [b"real-audio"]
    assert fake_session.closed is True

    trace_files = sorted((Path(server.os.getenv("NERDY_TURN_TRACE_DIR", ""))).glob("*.json"))
    assert len(trace_files) == 1
    trace_payload = json.loads(trace_files[0].read_text())
    assert trace_payload["stt"]["source"] == "stt"
    assert trace_payload["stt"]["transcript_text"] == "heard from audio"
    assert trace_payload["llm"]["messages"][-1]["content"] == "heard from audio"
    assert trace_payload["llm"]["result"]["text"] == committed_text["text"]
    assert trace_payload["tts"]["chunks"][0]["provider"] == "cartesia"
    assert trace_payload["latency"]["events"][0]["name"] == "speech_end"


def test_session_server_rejects_invalid_runtime_model_and_recovers_idle() -> None:
    client = TestClient(server.app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "Explain fractions",
                "llm_provider": "minimax",
                "llm_model": "gemini-2.5-flash",
            }
        )

        thinking = websocket.receive_json()
        transcript = websocket.receive_json()
        error_event = websocket.receive_json()
        idle = websocket.receive_json()

    assert thinking == {"type": "state.changed", "state": "thinking"}
    assert transcript == {"type": "transcript.final", "text": "Explain fractions"}
    assert error_event == {
        "type": "session.error",
        "detail": "unsupported llm model for minimax: gemini-2.5-flash",
    }
    assert idle == {"type": "state.changed", "state": "idle"}


def test_session_server_persists_history_and_profile_between_turns(monkeypatch) -> None:
    captured_calls: list[dict[str, object]] = []
    fake_session = _FakeSTTSession(final_text="heard from audio")

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
                "subject": subject,
                "grade_band": grade_band,
                "latest_student_text": latest_student_text,
                "history_length": len(history),
                "student_profile": student_profile or {},
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
    monkeypatch.setattr(server, "create_stt_provider", lambda: _FakeSTTProvider(fake_session))

    client = TestClient(server.app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "audio.chunk",
                "sequence": 1,
                "size": 320,
                "bytes_b64": base64.b64encode(b"audio-turn-one").decode("ascii"),
            }
        )
        websocket.receive_json()
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "typed fallback should lose",
                "subject": "math",
                "grade_band": "6-8",
                "student_profile": {"pacing": "slow"},
            }
        )
        for _ in range(8):
            websocket.receive_json()

        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 2000,
                "text": "Is it 5?",
            }
        )
        for _ in range(8):
            websocket.receive_json()

    assert captured_calls[0]["history_length"] == 0
    assert captured_calls[0]["latest_student_text"] != "typed fallback should lose"
    assert captured_calls[0]["student_profile"] == {"pacing": "slow"}
    assert captured_calls[1]["subject"] == "math"
    assert captured_calls[1]["grade_band"] == "6-8"
    assert captured_calls[1]["history_length"] == 2
    assert captured_calls[1]["latest_student_text"] == "Is it 5?"
    assert captured_calls[1]["student_profile"] == {"pacing": "slow"}
    assert fake_session.audio_payloads == [b"audio-turn-one"]
    assert fake_session.closed is True


def test_session_server_rejects_empty_transcript_and_returns_idle(monkeypatch) -> None:
    fake_session = _FakeSTTSession(final_text="")
    monkeypatch.setattr(server, "create_stt_provider", lambda: _FakeSTTProvider(fake_session))
    client = TestClient(server.app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "audio.chunk",
                "sequence": 1,
                "size": 320,
                "bytes_b64": base64.b64encode(b"quiet-audio").decode("ascii"),
            }
        )
        websocket.receive_json()
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "",
            }
        )

        thinking = websocket.receive_json()
        error_event = websocket.receive_json()
        idle = websocket.receive_json()

    assert thinking == {"type": "state.changed", "state": "thinking"}
    assert error_event == {"type": "session.error", "detail": "No speech detected"}
    assert idle == {"type": "state.changed", "state": "idle"}
    assert fake_session.closed is True


def test_session_server_uses_history_aware_follow_up_reply_for_math_stub() -> None:
    client = TestClient(server.app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "2+2",
                "subject": "math",
                "grade_band": "6-8",
            }
        )
        first_events = [websocket.receive_json() for _ in range(8)]

        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 2000,
                "text": "4",
            }
        )
        second_events = [websocket.receive_json() for _ in range(8)]

    first_reply = " ".join(event["text"] for event in first_events if event["type"] == "tutor.text.committed").strip()
    second_reply = " ".join(event["text"] for event in second_events if event["type"] == "tutor.text.committed").strip()

    assert first_reply == "Let's work on 2+2. What total do you get when you add 2 and 2?"
    assert second_reply == "That's right; 2+2 gives 4. How did you get 4?"


def test_session_server_keeps_active_math_problem_for_help_follow_up() -> None:
    client = TestClient(server.app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "2+2?",
                "subject": "math",
                "grade_band": "6-8",
            }
        )
        first_events = [websocket.receive_json() for _ in range(8)]

        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 2000,
                "text": "yes pelase help me to sovle it",
            }
        )
        second_events = [websocket.receive_json() for _ in range(8)]

    first_reply = " ".join(event["text"] for event in first_events if event["type"] == "tutor.text.committed").strip()
    second_reply = " ".join(event["text"] for event in second_events if event["type"] == "tutor.text.committed").strip()

    assert first_reply == "Let's work on 2+2. What total do you get when you add 2 and 2?"
    assert second_reply == "Let's work on 2+2. What total do you get when you add 2 and 2?"


def test_session_server_reset_clears_history_and_profile(monkeypatch) -> None:
    captured_calls: list[dict[str, object]] = []
    fake_session = _FakeSTTSession(final_text="heard from audio")

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
                "subject": subject,
                "grade_band": grade_band,
                "latest_student_text": latest_student_text,
                "history_length": len(history),
                "student_profile": student_profile or {},
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
    monkeypatch.setattr(server, "create_stt_provider", lambda: _FakeSTTProvider(fake_session))

    client = TestClient(server.app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "First lesson turn",
                "subject": "science",
                "grade_band": "9-10",
                "student_profile": {"pacing": "slow"},
            }
        )
        for _ in range(8):
            websocket.receive_json()

        websocket.send_json({"type": "session.reset"})
        reset_event = websocket.receive_json()

        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 2000,
                "text": "Fresh lesson turn",
            }
        )
        for _ in range(8):
            websocket.receive_json()

    assert reset_event == {"type": "session.reset", "state": "idle"}
    assert captured_calls[0]["history_length"] == 0
    assert captured_calls[0]["subject"] == "science"
    assert captured_calls[0]["grade_band"] == "9-10"
    assert captured_calls[0]["student_profile"] == {"pacing": "slow"}
    assert captured_calls[1]["history_length"] == 0
    assert captured_calls[1]["subject"] == "general"
    assert captured_calls[1]["grade_band"] == "6-8"
    assert captured_calls[1]["student_profile"] == {}


def test_session_server_restores_history_for_a_reconnected_session(monkeypatch) -> None:
    captured_calls: list[dict[str, object]] = []

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
                "subject": subject,
                "grade_band": grade_band,
                "history_length": len(history),
                "latest_student_text": latest_student_text,
                "student_profile": student_profile or {},
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
    client = TestClient(server.app)

    with client.websocket_connect("/ws/session?session_id=lesson-restore-1") as websocket:
        websocket.receive_json()
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
        websocket.receive_json()

    with client.websocket_connect("/ws/session?session_id=lesson-restore-1") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 2000,
                "text": "So it pulls things down?",
            }
        )
        for _ in range(8):
            websocket.receive_json()

    assert captured_calls[0]["subject"] == "science"
    assert captured_calls[0]["grade_band"] == "9-10"
    assert captured_calls[0]["history_length"] == 2
    assert captured_calls[0]["student_profile"] == {"preference": "use examples"}


def test_session_server_can_switch_tts_provider_per_turn() -> None:
    client = TestClient(server.app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "Can you help me with fractions?",
                "tts_provider": "minimax",
            }
        )
        for _ in range(6):
            websocket.receive_json()
        tts_audio = websocket.receive_json()
        tts_flush = websocket.receive_json()

    assert tts_audio["type"] == "tts.audio"
    assert tts_audio["provider"] == "minimax"
    assert tts_flush == {"type": "tts.flush", "provider": "minimax"}


def test_session_server_merges_default_and_per_turn_voice_config(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_TTS_VOICE_MINIMAX", "teacher-warm")
    client = TestClient(server.app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "Can you help me with fractions?",
                "tts_provider": "minimax",
                "voice_config": {"style": "calm"},
            }
        )
        for _ in range(4):
            websocket.receive_json()
        tts_context = websocket.receive_json()

    assert tts_context["type"] == "tts.context.started"
    assert tts_context["provider"] == "minimax"
    assert tts_context["voice_config"] == {
        "voice_id": "teacher-warm",
        "style": "calm",
    }


def test_session_server_returns_error_for_unknown_tts_provider() -> None:
    client = TestClient(server.app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "Can you help me with fractions?",
                "tts_provider": "unknown",
            }
        )
        thinking = websocket.receive_json()
        transcript = websocket.receive_json()
        error_event = websocket.receive_json()
        idle = websocket.receive_json()

    assert thinking == {"type": "state.changed", "state": "thinking"}
    assert transcript == {"type": "transcript.final", "text": "Can you help me with fractions?"}
    assert error_event["type"] == "session.error"
    assert "unknown tts provider: unknown" in error_event["detail"]
    assert idle == {"type": "state.changed", "state": "idle"}


def test_session_server_uses_subject_aware_tutor_draft_for_math_truth_checks() -> None:
    client = TestClient(server.app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "2+2=4 is it true?",
                "subject": "math",
                "grade_band": "6-8",
                "student_profile": {"preference": "Slow down, use concrete examples..."},
            }
        )
        for _ in range(5):
            websocket.receive_json()
        committed_text = websocket.receive_json()

    assert committed_text["type"] == "tutor.text.committed"
    assert "2 blocks" in committed_text["text"].lower()
    assert "what do you notice about" not in committed_text["text"].lower()


def test_session_server_reset_clears_history_and_profile(monkeypatch) -> None:
    captured_calls: list[dict[str, object]] = []

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
                "history_length": len(history),
                "student_profile": student_profile or {},
                "latest_student_text": latest_student_text,
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
    client = TestClient(server.app)

    with client.websocket_connect("/ws/session") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 1000,
                "text": "first question",
                "student_profile": {"preference": "go slow"},
            }
        )
        for _ in range(8):
            websocket.receive_json()

        websocket.send_json({"type": "session.reset"})
        websocket.receive_json()

        websocket.send_json(
            {
                "type": "speech.end",
                "ts_ms": 2000,
                "text": "second question",
            }
        )
        for _ in range(8):
            websocket.receive_json()

    assert captured_calls[0]["history_length"] == 0
    assert captured_calls[0]["student_profile"] == {"preference": "go slow"}
    assert captured_calls[1]["history_length"] == 0
    assert captured_calls[1]["student_profile"] == {}
