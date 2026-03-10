import base64
from io import BytesIO
import wave

from backend.monitoring.latency_tracker import LatencyTracker
from backend.tts.cartesia_client import CartesiaClient


def test_cartesia_client_marks_first_audio_and_returns_timestamps() -> None:
    tracker = LatencyTracker()
    client = CartesiaClient()
    start_event = client.start_context(turn_id="turn-1", voice_config={"voice_id": "calm"})

    event = client.send_phrase(
        "What should you do next?",
        tracker=tracker,
        first_audio_ts_ms=260,
    )

    assert start_event == {
        "type": "tts.context.started",
        "provider": "cartesia",
        "turn_id": "turn-1",
        "voice_config": {"voice_id": "calm"},
    }
    assert event["type"] == "tts.audio"
    assert event["timestamps"][0]["word"] == "What"
    assert tracker.events[0].name == "tts_first_audio"


def test_cartesia_client_flush_returns_final_event() -> None:
    client = CartesiaClient()

    event = client.flush()

    assert event == {"type": "tts.flush", "provider": "cartesia"}


def test_cartesia_client_cancel_returns_provider_event() -> None:
    client = CartesiaClient()

    event = client.cancel()

    assert event == {"type": "tts.cancel", "provider": "cartesia"}


def test_cartesia_client_uses_live_bytes_api_when_key_present(monkeypatch) -> None:
    class _FakeResponse:
        def __init__(self, body: bytes) -> None:
            self._body = body
            self._offset = 0

        def read(self, size: int = -1) -> bytes:
            if size < 0:
                size = len(self._body) - self._offset
            chunk = self._body[self._offset : self._offset + size]
            self._offset += len(chunk)
            return chunk

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    perf_values = iter([20.0, 20.18])
    tracker = LatencyTracker()
    client = CartesiaClient()
    audio_bytes = _build_wav(duration_ms=320)

    monkeypatch.setenv("CARTESIA_API_KEY", "cartesia-test")
    monkeypatch.setenv("NERDY_TTS_VOICE_CARTESIA", "voice-live")
    monkeypatch.setattr("backend.tts.cartesia_client.load_local_env", lambda: [])
    monkeypatch.setattr("backend.tts.cartesia_client.request.urlopen", lambda *args, **kwargs: _FakeResponse(audio_bytes))
    monkeypatch.setattr("backend.tts.cartesia_client.time.perf_counter", lambda: next(perf_values))

    client.start_context(turn_id="turn-live", voice_config={"voice_id": "voice-live"})
    event = client.send_phrase(
        "What should you do next?",
        tracker=tracker,
        first_audio_ts_ms=1000,
        is_final=True,
    )

    assert event["type"] == "tts.audio"
    assert event["audio_b64"] == base64.b64encode(audio_bytes).decode("ascii")
    assert event["audio_mime_type"] == "audio/wav"
    assert event["is_final"] is True
    assert event["timestamps"][-1]["end_ms"] == 320.0
    assert tracker.events[0].name == "tts_first_audio"
    assert tracker.events[0].ts_ms == 1180.0
    assert tracker.events[0].metadata["mode"] == "live"


def _build_wav(*, duration_ms: int) -> bytes:
    sample_rate = 8000
    frame_count = int(sample_rate * duration_ms / 1000)
    pcm = b"\x00\x00" * frame_count
    buffer = BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm)
    return buffer.getvalue()
