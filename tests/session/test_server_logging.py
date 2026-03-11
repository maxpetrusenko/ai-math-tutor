import asyncio
import logging

from backend.session.server import _handle_message
from backend.turn_taking.controller import SessionController


class _FakeSTTSession:
    def __init__(self) -> None:
        self.audio_payloads: list[bytes] = []
        self.audio_timestamps: list[float | None] = []

    async def push_audio(self, chunk: bytes, *, ts_ms: float | None = None) -> list[dict[str, str]]:
        self.audio_payloads.append(chunk)
        self.audio_timestamps.append(ts_ms)
        return []

    async def finalize(self, *, ts_ms: float) -> list[dict[str, str]]:
        return []

    async def close(self) -> None:
        return None


class _FakeSTTProvider:
    def __init__(self) -> None:
        self.session = _FakeSTTSession()

    async def open_session(self, tracker) -> _FakeSTTSession:
        return self.session


def test_handle_message_logs_audio_chunk_summary(caplog) -> None:
    async def run() -> tuple[list[dict[str, object]], _FakeSTTSession | None, _FakeSTTProvider]:
        controller = SessionController(session_id="lesson-log-1")
        provider = _FakeSTTProvider()
        events, stt_session = await _handle_message(
            controller,
            {
                "type": "audio.chunk",
                "sequence": 3,
                "size": 1024,
                "bytes_b64": "YWJjZA==",
                "mime_type": "audio/webm;codecs=opus",
                "ts_ms": 1234,
            },
            provider,
            None,
        )
        return events, stt_session, provider

    caplog.set_level(logging.INFO)
    events, stt_session, provider = asyncio.run(run())

    assert stt_session is provider.session
    assert provider.session.audio_payloads == [b"abcd"]
    assert provider.session.audio_timestamps == [1234.0]
    assert events[0]["type"] == "state.changed"
    assert "session websocket audio chunk" in caplog.text
    assert "session websocket opening stt session" in caplog.text
    assert "session websocket audio decoded" in caplog.text
    assert '"bytes_b64_length": 8' in caplog.text
    assert '"decoded_bytes": 4' in caplog.text
    assert '"mime_type": "audio/webm;codecs=opus"' in caplog.text
    assert '"ts_ms": 1234.0' in caplog.text


def test_handle_message_logs_missing_transcript_once(caplog) -> None:
    async def run() -> tuple[list[dict[str, object]], _FakeSTTSession | None]:
        controller = SessionController(session_id="lesson-log-2")
        provider = _FakeSTTProvider()
        return await _handle_message(
            controller,
            {
                "type": "speech.end",
                "grade_band": "6-8",
                "subject": "math",
                "text": "",
                "ts_ms": 1000,
            },
            provider,
            None,
        )

    caplog.set_level(logging.INFO)
    events, stt_session = asyncio.run(run())

    assert stt_session is None
    assert events == [
        {"type": "state.changed", "state": "thinking"},
        {"type": "session.error", "detail": "No speech detected"},
        {"type": "state.changed", "state": "idle"},
    ]
    assert "session transcript missing" in caplog.text
    assert '"source": "missing"' in caplog.text


def test_handle_message_logs_stt_finalize_summary(caplog) -> None:
    class _FinalizeLoggingSTTSession(_FakeSTTSession):
        async def finalize(self, *, ts_ms: float) -> list[dict[str, str]]:
            return [
                {"type": "transcript.partial_stable", "text": "stable partial"},
                {"type": "transcript.final", "text": "final transcript"},
            ]

    class _FinalizeLoggingSTTProvider:
        def __init__(self) -> None:
            self.session = _FinalizeLoggingSTTSession()

        async def open_session(self, tracker) -> _FinalizeLoggingSTTSession:
            return self.session

    async def run() -> tuple[list[dict[str, object]], _FakeSTTSession | None]:
        controller = SessionController(session_id="lesson-log-3")
        provider = _FinalizeLoggingSTTProvider()
        _, stt_session = await _handle_message(
            controller,
            {
                "type": "audio.chunk",
                "sequence": 1,
                "size": 320,
                "bytes_b64": "YWJj",
                "mime_type": "audio/webm;codecs=opus",
                "ts_ms": 1234,
            },
            provider,
            None,
        )
        return await _handle_message(
            controller,
            {
                "type": "speech.end",
                "grade_band": "6-8",
                "subject": "math",
                "text": "",
                "transcribe_only": True,
                "ts_ms": 1400,
            },
            provider,
            stt_session,
        )

    caplog.set_level(logging.INFO)
    asyncio.run(run())

    assert "session stt.finalize end" in caplog.text
    assert '"event_count": 2' in caplog.text
    assert '"event_types": {"transcript.final": 1, "transcript.partial_stable": 1}' in caplog.text
    assert '"has_final": true' in caplog.text
    assert '"has_partial_stable": true' in caplog.text
