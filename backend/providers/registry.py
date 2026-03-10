from __future__ import annotations

import os
from importlib import import_module

from backend.providers.base import (
    BaseAvatarProvider,
    BaseLLMProvider,
    BaseSTTProvider,
    BaseTTSProvider,
)


class ProviderRegistry:
    """Registry for provider implementations."""

    _stt_providers: dict[str, type[BaseSTTProvider]] = {}
    _llm_providers: dict[str, type[BaseLLMProvider]] = {}
    _tts_providers: dict[str, type[BaseTTSProvider]] = {}
    _avatar_providers: dict[str, type[BaseAvatarProvider]] = {}

    @classmethod
    def register_stt(cls, provider_cls: type[BaseSTTProvider]) -> type[BaseSTTProvider]:
        cls._stt_providers[provider_cls.provider_name] = provider_cls
        return provider_cls

    @classmethod
    def register_llm(cls, provider_cls: type[BaseLLMProvider]) -> type[BaseLLMProvider]:
        cls._llm_providers[provider_cls.provider_name] = provider_cls
        return provider_cls

    @classmethod
    def register_tts(cls, provider_cls: type[BaseTTSProvider]) -> type[BaseTTSProvider]:
        cls._tts_providers[provider_cls.provider_name] = provider_cls
        return provider_cls

    @classmethod
    def register_avatar(cls, provider_cls: type[BaseAvatarProvider]) -> type[BaseAvatarProvider]:
        cls._avatar_providers[provider_cls.provider_name] = provider_cls
        return provider_cls

    @classmethod
    def get_stt(cls, name: str | None = None) -> type[BaseSTTProvider]:
        name = name or os.getenv("NERDY_STT_PROVIDER", "deepgram")
        if name not in cls._stt_providers:
            raise ValueError(f"unknown stt provider: {name}")
        return cls._stt_providers[name]

    @classmethod
    def get_llm(cls, name: str | None = None) -> type[BaseLLMProvider]:
        name = name or os.getenv("NERDY_LLM_PROVIDER", "minimax")
        if name not in cls._llm_providers:
            raise ValueError(f"unknown llm provider: {name}")
        return cls._llm_providers[name]

    @classmethod
    def get_tts(cls, name: str | None = None) -> type[BaseTTSProvider]:
        name = name or os.getenv("NERDY_TTS_PROVIDER", "cartesia")
        if name not in cls._tts_providers:
            raise ValueError(f"unknown tts provider: {name}")
        return cls._tts_providers[name]

    @classmethod
    def get_avatar(cls, name: str | None = None) -> type[BaseAvatarProvider]:
        name = name or os.getenv("NERDY_AVATAR_PROVIDER", "threejs")
        if name not in cls._avatar_providers:
            raise ValueError(f"unknown avatar provider: {name}")
        return cls._avatar_providers[name]


def get_provider(
    provider_type: str,
    name: str | None = None,
):
    """Get provider instance by type and name."""
    match provider_type:
        case "stt":
            return ProviderRegistry.get_stt(name)
        case "llm":
            return ProviderRegistry.get_llm(name)
        case "tts":
            return ProviderRegistry.get_tts(name)
        case "avatar":
            return ProviderRegistry.get_avatar(name)
        case _:
            raise ValueError(f"Unknown provider type: {provider_type}")


def auto_register_providers() -> None:
    """Auto-discover and register provider implementations."""
    stt_modules = os.getenv("STT_MODULES", "backend.providers.stt.deepgram").split(",")
    llm_modules = os.getenv("LLM_MODULES", "backend.providers.llm.minimax,backend.providers.llm.gemini").split(",")
    tts_modules = os.getenv("TTS_MODULES", "backend.providers.tts.cartesia,backend.providers.tts.minimax").split(",")
    avatar_modules = os.getenv("AVATAR_MODULES", "backend.providers.avatar.threejs").split(",")

    for module_path in stt_modules + llm_modules + tts_modules + avatar_modules:
        try:
            import_module(module_path)
        except Exception:
            pass  # Optional modules may not exist
