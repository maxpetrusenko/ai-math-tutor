from __future__ import annotations

from backend.providers.base import BaseSTTProvider
from backend.providers.registry import ProviderRegistry
from backend.stt.deepgram_client import DeepgramStreamingClient
from backend.stt.provider import StreamingSTTSession


@ProviderRegistry.register_stt
class DeepgramProvider(BaseSTTProvider):
    """Deepgram STT provider wrapper."""

    provider_name = "deepgram"

    def __init__(self, stability_repeats: int = 2, model: str = "nova-3") -> None:
        self._client = DeepgramStreamingClient(stability_repeats=stability_repeats, model=model)

    async def open_session(self, tracker) -> StreamingSTTSession:
        return await self._client.open_session(tracker)
