from __future__ import annotations

import json
import os
from typing import Any
from urllib import error, request

from backend.runtime.local_env import load_local_env

OPENAI_REALTIME_CLIENT_SECRET_URL = "https://api.openai.com/v1/realtime/client_secrets"
DEFAULT_OPENAI_REALTIME_MODEL = "gpt-realtime-mini"
DEFAULT_OPENAI_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"
DEFAULT_OPENAI_REALTIME_VOICE = "marin"


def create_realtime_client_secret(payload: dict[str, object] | None = None) -> dict[str, Any]:
    load_local_env()
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY is required for OpenAI Realtime")

    request_payload = _build_client_secret_payload(payload or {})
    response = _post_json(
        OPENAI_REALTIME_CLIENT_SECRET_URL,
        body=request_payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    return response


def _build_client_secret_payload(payload: dict[str, object]) -> dict[str, object]:
    model = str(payload.get("model") or DEFAULT_OPENAI_REALTIME_MODEL).strip() or DEFAULT_OPENAI_REALTIME_MODEL
    voice = str(payload.get("voice") or DEFAULT_OPENAI_REALTIME_VOICE).strip() or DEFAULT_OPENAI_REALTIME_VOICE
    instructions = str(payload.get("instructions") or "").strip()

    session_payload: dict[str, object] = {
        "type": "realtime",
        "model": model,
        "output_modalities": ["audio", "text"],
        "audio": {
            "input": {
                "format": {"type": "audio/pcm", "rate": 24_000},
                "transcription": {
                    "language": "en",
                    "model": DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
                },
                "turn_detection": None,
            },
            "output": {
                "format": {"type": "audio/pcm", "rate": 24_000},
                "voice": voice,
            },
        },
    }
    if instructions:
        session_payload["instructions"] = instructions

    return {
        "expires_after": {
            "anchor": "created_at",
            "seconds": 600,
        },
        "session": session_payload,
    }


def _post_json(url: str, *, body: dict[str, object], headers: dict[str, str]) -> dict[str, Any]:
    encoded_body = json.dumps(body).encode("utf-8")
    req = request.Request(url, data=encoded_body, headers=headers, method="POST")
    try:
        with request.urlopen(req, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(detail or f"OpenAI Realtime request failed with status {exc.code}") from exc

    if not isinstance(payload, dict):
        raise RuntimeError("OpenAI Realtime returned an unexpected response")
    return payload
