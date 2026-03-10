from __future__ import annotations

import os

# Provider defaults - can be overridden via environment
STT_PROVIDER = os.getenv("NERDY_STT_PROVIDER", "deepgram")
LLM_PROVIDER = os.getenv("NERDY_LLM_PROVIDER", "minimax")
LLM_FALLBACK_PROVIDER = os.getenv("NERDY_LLM_FALLBACK_PROVIDER", "gemini")
TTS_PROVIDER = os.getenv("NERDY_TTS_PROVIDER", "cartesia")
AVATAR_PROVIDER = os.getenv("NERDY_AVATAR_PROVIDER", "threejs")

# Available providers
STT_PROVIDERS = ["deepgram", "elevenlabs", "google"]
LLM_PROVIDERS = ["minimax", "gemini", "openai", "anthropic"]
TTS_PROVIDERS = ["cartesia", "elevenlabs", "google", "azure"]
AVATAR_PROVIDERS = ["css", "threejs", "readyplayer"]

# Auto-register providers on import
from backend.providers.registry import auto_register_providers
auto_register_providers()
