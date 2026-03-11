import asyncio

from backend.monitoring.latency_tracker import LatencyTracker
from backend.providers.stt.deepgram import DeepgramProvider
from backend.providers.tts.cartesia import CartesiaProvider
from backend.providers.tts.minimax import MiniMaxTTSProvider


def test_deepgram_provider_delegates_open_session(monkeypatch) -> None:
    sentinel = object()
    provider = DeepgramProvider()

    async def fake_open_session(tracker: LatencyTracker) -> object:
        return sentinel

    monkeypatch.setattr(provider._client, "open_session", fake_open_session)

    session = asyncio.run(provider.open_session(LatencyTracker()))

    assert session is sentinel


def test_deepgram_provider_defaults_to_nova_3() -> None:
    provider = DeepgramProvider()

    assert provider._client.config.model == "nova-3"


def test_cartesia_provider_exposes_context_and_cancel() -> None:
    provider = CartesiaProvider()

    start_event = provider.start_context("turn-1", {"voice_id": "calm"})
    cancel_event = provider.cancel()

    assert start_event["type"] == "tts.context.started"
    assert start_event["voice_config"] == {"voice_id": "calm"}
    assert cancel_event == {"type": "tts.cancel", "provider": "cartesia"}


def test_minimax_tts_provider_exposes_context_and_cancel() -> None:
    provider = MiniMaxTTSProvider()

    start_event = provider.start_context("turn-1", {"voice_id": "warm"})
    cancel_event = provider.cancel()

    assert start_event["type"] == "tts.context.started"
    assert start_event["provider"] == "minimax"
    assert cancel_event == {"type": "tts.cancel", "provider": "minimax"}
