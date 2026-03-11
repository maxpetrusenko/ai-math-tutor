from __future__ import annotations

import json
import os
import socket
from typing import Any
from urllib import error, request

from backend.runtime.local_env import load_local_env

OPENAI_REALTIME_CLIENT_SECRET_URL = "https://api.openai.com/v1/realtime/client_secrets"
OPENAI_REALTIME_CLIENT_SECRET_TIMEOUT_SECONDS = 20
DEFAULT_OPENAI_REALTIME_MODEL = "gpt-realtime-mini"
DEFAULT_OPENAI_TRANSCRIPTION_MODEL = "gpt-4o-transcribe"
DEFAULT_OPENAI_REALTIME_VOICE = "marin"
ALLOWED_OPENAI_SESSION_TYPES = {"realtime", "transcription"}


class OpenAIRealtimeClientSecretError(RuntimeError):
    """Base error for OpenAI Realtime client-secret failures."""


class OpenAIRealtimeClientSecretTimeoutError(OpenAIRealtimeClientSecretError):
    """Raised when the upstream client-secret request times out."""


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
    requested_session_type = str(payload.get("session_type") or "").strip().lower()
    session_type = (
        requested_session_type
        if requested_session_type in ALLOWED_OPENAI_SESSION_TYPES
        else "transcription" if _is_transcription_model(model) else "realtime"
    )
    voice = str(payload.get("voice") or DEFAULT_OPENAI_REALTIME_VOICE).strip() or DEFAULT_OPENAI_REALTIME_VOICE
    instructions = str(payload.get("instructions") or "").strip()

    if session_type == "transcription":
        session_payload: dict[str, object] = {
            "type": "transcription",
            "audio": {
                "input": {
                    "format": {"type": "audio/pcm", "rate": 24_000},
                    "transcription": {
                        "language": "en",
                        "model": model,
                    },
                    "turn_detection": None,
                }
            },
        }
    else:
        session_payload = {
            "type": "realtime",
            "model": model,
            "output_modalities": ["audio"],
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
        with request.urlopen(req, timeout=OPENAI_REALTIME_CLIENT_SECRET_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (TimeoutError, socket.timeout) as exc:
        raise OpenAIRealtimeClientSecretTimeoutError("OpenAI Realtime client secret request timed out") from exc
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise OpenAIRealtimeClientSecretError(detail or f"OpenAI Realtime request failed with status {exc.code}") from exc
    except error.URLError as exc:
        if _is_timeout_reason(exc.reason):
            raise OpenAIRealtimeClientSecretTimeoutError("OpenAI Realtime client secret request timed out") from exc
        detail = str(exc.reason).strip() or "unknown network error"
        raise OpenAIRealtimeClientSecretError(f"OpenAI Realtime client secret request failed: {detail}") from exc

    if not isinstance(payload, dict):
        raise OpenAIRealtimeClientSecretError("OpenAI Realtime returned an unexpected response")
    return payload


def _is_timeout_reason(reason: object) -> bool:
    if isinstance(reason, (TimeoutError, socket.timeout)):
        return True
    return "timed out" in str(reason).lower()


def _is_transcription_model(model: str) -> bool:
    normalized = model.strip().lower()
    return normalized.endswith("-transcribe") or normalized.endswith("-transcribe-diarize")
