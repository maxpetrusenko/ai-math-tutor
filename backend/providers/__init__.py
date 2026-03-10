from __future__ import annotations

import os

from backend.providers.base import BaseSTTProvider, BaseLLMProvider, BaseTTSProvider
from backend.providers.registry import ProviderRegistry, auto_register_providers, get_provider


def create_provider(provider_type: str, name: str | None = None):
    auto_register_providers()

    default_names = {
        "stt": os.getenv("NERDY_STT_PROVIDER", "deepgram"),
        "llm": os.getenv("NERDY_LLM_PROVIDER", "minimax"),
        "tts": os.getenv("NERDY_TTS_PROVIDER", "cartesia"),
        "avatar": os.getenv("NERDY_AVATAR_PROVIDER", "threejs"),
    }
    provider_cls = get_provider(provider_type, name or default_names.get(provider_type))
    return provider_cls()


__all__ = [
    "BaseSTTProvider",
    "BaseLLMProvider",
    "BaseTTSProvider",
    "ProviderRegistry",
    "create_provider",
    "get_provider",
]
