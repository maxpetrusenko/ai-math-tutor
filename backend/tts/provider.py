from __future__ import annotations

import os
from typing import Protocol

from backend.monitoring.latency_tracker import LatencyTracker
from backend.providers import create_provider


class TTSProvider(Protocol):
    provider_name: str

    def start_context(self, turn_id: str, voice_config: dict[str, str] | None = None) -> dict[str, object]:
        ...

    def send_phrase(
        self,
        text: str,
        tracker: LatencyTracker,
        first_audio_ts_ms: float,
        is_final: bool = False,
    ) -> dict[str, object]:
        ...

    def flush(self) -> dict[str, object]:
        ...

    def cancel(self) -> dict[str, object]:
        ...


class TTSProviderFactory:
    def create(self, provider_name: str | None = None) -> TTSProvider:
        return create_provider("tts", provider_name)

    def default_voice_config(self, provider_name: str | None = None) -> dict[str, str]:
        normalized = self._resolve_provider_name(provider_name)
        voice_env = {
            "cartesia": "NERDY_TTS_VOICE_CARTESIA",
            "minimax": "NERDY_TTS_VOICE_MINIMAX",
        }.get(normalized)
        if voice_env is None:
            raise ValueError(f"unknown tts provider: {normalized}")

        voice_id = os.getenv(voice_env, "").strip()
        if not voice_id:
            return {}
        return {"voice_id": voice_id}

    def _resolve_provider_name(self, provider_name: str | None) -> str:
        configured_name = provider_name or os.getenv("NERDY_TTS_PROVIDER", "cartesia")
        return configured_name.strip().lower()
