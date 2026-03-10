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
