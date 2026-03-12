from __future__ import annotations

import json
import os
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

import aiohttp

from backend.runtime.local_env import load_local_env

LIVEKIT_AVATAR_AGENT_NAME = "nerdy-avatar-agent"
DEFAULT_SIMLI_FACE_ID = "b97a7777-a82e-4925-ad14-861d62c32bec"


@dataclass(frozen=True)
class ManagedAvatarTarget:
    provider_id: str
    provider: str
    label: str
    avatar_id: str
    metadata: dict[str, object]


def is_managed_avatar_provider_id(provider_id: str) -> bool:
    return provider_id in {"simli-b97a7777-live", "heygen-liveavatar-default"}


def _coalesce_env(env: Mapping[str, str], *keys: str) -> str:
    for key in keys:
        value = env.get(key, "").strip()
        if value:
            return value
    return ""


def _runtime_env(env: Mapping[str, str] | None = None) -> Mapping[str, str]:
    if env is not None:
        return env

    load_local_env()
    return os.environ


def resolve_managed_avatar_metadata(
    provider_id: str,
    env: Mapping[str, str] | None = None,
) -> ManagedAvatarTarget:
    resolved_env = _runtime_env(env)
    voice = resolved_env.get("NERDY_LIVEKIT_OPENAI_VOICE", "alloy").strip() or "alloy"
    instructions = (
        resolved_env.get("NERDY_LIVEKIT_AGENT_INSTRUCTIONS", "").strip()
        or "Talk to me like a clear, encouraging tutor."
    )

    if provider_id == "simli-b97a7777-live":
        face_id = _coalesce_env(resolved_env, "SIMLI_FACE_ID") or DEFAULT_SIMLI_FACE_ID
        metadata = {
            "provider": "simli",
            "provider_id": provider_id,
            "label": "Simli",
            "face_id": face_id,
            "voice": voice,
            "instructions": instructions,
        }
        return ManagedAvatarTarget(
            provider_id=provider_id,
            provider="simli",
            label="Simli",
            avatar_id=face_id,
            metadata=metadata,
        )

    if provider_id == "heygen-liveavatar-default":
        avatar_id = _coalesce_env(resolved_env, "LIVEAVATAR_AVATAR_ID", "HEYGEN_AVATAR_ID")
        if not avatar_id:
            avatar_id = "default"
        metadata = {
            "provider": "liveavatar",
            "provider_id": provider_id,
            "label": "HeyGen LiveAvatar",
            "avatar_id": avatar_id,
            "voice": voice,
            "instructions": instructions,
            "is_sandbox": resolved_env.get("LIVEAVATAR_IS_SANDBOX", "0").strip().lower() in {"1", "true", "yes", "on"},
        }
        return ManagedAvatarTarget(
            provider_id=provider_id,
            provider="liveavatar",
            label="HeyGen LiveAvatar",
            avatar_id=avatar_id,
            metadata=metadata,
        )

    raise ValueError(f"unknown managed avatar provider: {provider_id}")


def collect_avatar_bootstrap_errors(
    provider_id: str,
    env: Mapping[str, str] | None = None,
) -> list[str]:
    resolved_env = _runtime_env(env)
    errors: list[str] = []

    for key in ("LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "OPENAI_API_KEY"):
        if not resolved_env.get(key, "").strip():
            errors.append(f"{key} is required for managed avatar sessions.")

    if provider_id == "simli-b97a7777-live":
        if not resolved_env.get("SIMLI_API_KEY", "").strip():
            errors.append("SIMLI_API_KEY is required for Simli avatar sessions.")
    elif provider_id == "heygen-liveavatar-default":
        if not _coalesce_env(resolved_env, "LIVEAVATAR_API_KEY", "HEYGEN_API_KEY"):
            errors.append("LIVEAVATAR_API_KEY or HEYGEN_API_KEY is required for HeyGen LiveAvatar sessions.")
        if not _coalesce_env(resolved_env, "LIVEAVATAR_AVATAR_ID", "HEYGEN_AVATAR_ID"):
            errors.append("LIVEAVATAR_AVATAR_ID or HEYGEN_AVATAR_ID is required for HeyGen LiveAvatar sessions.")
    else:
        errors.append(f"unknown managed avatar provider: {provider_id}")

    return errors


def _build_room_name(provider: str) -> str:
    return f"nerdy-{provider}-{uuid4().hex[:12]}"


def _client_livekit_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme == "http":
        parsed = parsed._replace(scheme="ws")
    elif parsed.scheme == "https":
        parsed = parsed._replace(scheme="wss")
    return urlunparse(parsed)


def _describe_simli_bootstrap_failure(detail: str, *, face_id: str) -> str:
    normalized = detail.strip() or "unknown_error"
    if normalized == "INVALID_FACE_ID":
        return (
            "Simli rejected the configured face ID. "
            "Use a Compose-compatible `SIMLI_FACE_ID`, not the UUID from the public avatar page."
        )
    return f"Simli session bootstrap failed: {normalized}"


async def _validate_simli_avatar_target(target: ManagedAvatarTarget, env: Mapping[str, str]) -> None:
    compose_payload = {
        "faceId": target.avatar_id,
        "handleSilence": True,
        "maxSessionLength": 600,
        "maxIdleTime": 30,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.simli.ai/compose/token",
            json=compose_payload,
            headers={"x-simli-api-key": env["SIMLI_API_KEY"].strip()},
        ) as response:
            if response.status < 400:
                return
            try:
                payload = json.loads(await response.text())
            except json.JSONDecodeError:
                payload = {}
            detail = str(payload.get("detail") or f"http_{response.status}")
            raise ValueError(_describe_simli_bootstrap_failure(detail, face_id=target.avatar_id))


async def create_avatar_room_session(
    provider_id: str,
    *,
    participant_name: str = "Student",
    env: Mapping[str, str] | None = None,
) -> dict[str, object]:
    from livekit import api

    resolved_env = _runtime_env(env)
    errors = collect_avatar_bootstrap_errors(provider_id, resolved_env)
    if errors:
        raise ValueError("; ".join(errors))

    target = resolve_managed_avatar_metadata(provider_id, resolved_env)
    if target.provider == "simli":
        await _validate_simli_avatar_target(target, resolved_env)
    room_name = _build_room_name(target.provider)
    room_metadata = json.dumps(target.metadata)
    participant_identity = f"web-{uuid4().hex[:12]}"
    livekit_url = resolved_env["LIVEKIT_URL"].strip()

    async with api.LiveKitAPI(
        url=livekit_url,
        api_key=resolved_env["LIVEKIT_API_KEY"].strip(),
        api_secret=resolved_env["LIVEKIT_API_SECRET"].strip(),
    ) as livekit_api:
        await livekit_api.room.create_room(
            api.CreateRoomRequest(
                name=room_name,
                metadata=room_metadata,
                empty_timeout=10 * 60,
                max_participants=4,
            )
        )
        await livekit_api.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name=LIVEKIT_AVATAR_AGENT_NAME,
                room=room_name,
                metadata=room_metadata,
            )
        )

    token = (
        api.AccessToken(
            api_key=resolved_env["LIVEKIT_API_KEY"].strip(),
            api_secret=resolved_env["LIVEKIT_API_SECRET"].strip(),
        )
        .with_identity(participant_identity)
        .with_name(participant_name)
        .with_metadata(room_metadata)
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
        .with_ttl(timedelta(hours=1))
        .to_jwt()
    )

    return {
        "provider_id": provider_id,
        "provider": target.provider,
        "participant_identity": participant_identity,
        "room_name": room_name,
        "room_metadata": target.metadata,
        "token": token,
        "url": _client_livekit_url(livekit_url),
    }
