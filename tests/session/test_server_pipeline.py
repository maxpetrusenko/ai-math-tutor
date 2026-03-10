import base64

from fastapi.testclient import TestClient

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
        for _ in range(4):
            websocket.receive_json()
        error_event = websocket.receive_json()

    assert error_event["type"] == "session.error"
    assert "unknown tts provider" in error_event["detail"]


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
