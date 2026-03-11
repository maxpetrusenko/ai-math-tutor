from __future__ import annotations

import os
from typing import TypedDict

from backend.llm.gemini_fallback_client import DEFAULT_GEMINI_MODEL
from backend.tts.cartesia_client import DEFAULT_CARTESIA_MODEL

DEFAULT_MINIMAX_LLM_MODEL = "minimax-m2.5"
DEFAULT_MINIMAX_TTS_MODEL = "minimax-speech"


class RuntimeConfig(TypedDict):
    llm_model: str
    llm_provider: str
    tts_model: str
    tts_provider: str


ALLOWED_RUNTIME_OPTIONS = {
    "llm": {
        "gemini": [DEFAULT_GEMINI_MODEL],
        "minimax": [DEFAULT_MINIMAX_LLM_MODEL],
    },
    "tts": {
        "cartesia": [DEFAULT_CARTESIA_MODEL],
        "minimax": [DEFAULT_MINIMAX_TTS_MODEL],
    },
}


def runtime_options_payload() -> dict[str, object]:
    return {
        "defaults": default_runtime_config(),
        "options": ALLOWED_RUNTIME_OPTIONS,
    }


def default_runtime_config() -> RuntimeConfig:
    llm_provider = os.getenv("NERDY_RUNTIME_LLM_PROVIDER", "gemini").strip().lower() or "gemini"
    tts_provider = os.getenv("NERDY_TTS_PROVIDER", "cartesia").strip().lower() or "cartesia"
    return {
        "llm_provider": llm_provider if llm_provider in ALLOWED_RUNTIME_OPTIONS["llm"] else "gemini",
        "llm_model": _default_model("llm", llm_provider if llm_provider in ALLOWED_RUNTIME_OPTIONS["llm"] else "gemini"),
        "tts_provider": tts_provider if tts_provider in ALLOWED_RUNTIME_OPTIONS["tts"] else "cartesia",
        "tts_model": _default_model("tts", tts_provider if tts_provider in ALLOWED_RUNTIME_OPTIONS["tts"] else "cartesia"),
    }


def validate_runtime_config(payload: dict[str, object]) -> RuntimeConfig:
    defaults = default_runtime_config()
    llm_provider = str(payload.get("llm_provider") or defaults["llm_provider"]).strip().lower()
    tts_provider = str(payload.get("tts_provider") or defaults["tts_provider"]).strip().lower()

    if llm_provider not in ALLOWED_RUNTIME_OPTIONS["llm"]:
        raise ValueError(f"unknown llm provider: {llm_provider}")
    if tts_provider not in ALLOWED_RUNTIME_OPTIONS["tts"]:
        raise ValueError(f"unknown tts provider: {tts_provider}")

    llm_model = str(payload.get("llm_model") or _default_model("llm", llm_provider)).strip()
    tts_model = str(payload.get("tts_model") or _default_model("tts", tts_provider)).strip()

    if llm_model not in ALLOWED_RUNTIME_OPTIONS["llm"][llm_provider]:
        raise ValueError(f"unsupported llm model for {llm_provider}: {llm_model}")
    if tts_model not in ALLOWED_RUNTIME_OPTIONS["tts"][tts_provider]:
        raise ValueError(f"unsupported tts model for {tts_provider}: {tts_model}")

    return {
        "llm_provider": llm_provider,
        "llm_model": llm_model,
        "tts_provider": tts_provider,
        "tts_model": tts_model,
    }


def _default_model(kind: str, provider: str) -> str:
    return ALLOWED_RUNTIME_OPTIONS[kind][provider][0]
