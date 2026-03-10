from __future__ import annotations

from backend.providers.base import BaseTTSProvider
from backend.providers.registry import ProviderRegistry
from backend.tts.cartesia_client import CartesiaClient

@ProviderRegistry.register_tts
class CartesiaProvider(BaseTTSProvider):
    """Cartesia TTS provider wrapper."""

    provider_name = "cartesia"

    def __init__(self) -> None:
        self._client = CartesiaClient()

    def start_context(self, turn_id: str, voice_config: dict[str, str] | None = None) -> dict[str, object]:
        return self._client.start_context(turn_id=turn_id, voice_config=voice_config)

    def send_phrase(
        self,
        text: str,
        tracker,
        first_audio_ts_ms: float,
        is_final: bool = False,
    ) -> dict[str, object]:
        return self._client.send_phrase(
            text=text,
            tracker=tracker,
            first_audio_ts_ms=first_audio_ts_ms,
            is_final=is_final,
        )

    def flush(self) -> dict[str, object]:
        return self._client.flush()

    def cancel(self) -> dict[str, object]:
        return self._client.cancel()
