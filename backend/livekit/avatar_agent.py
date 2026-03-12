from __future__ import annotations

import json
import logging
import os

from livekit.agents import Agent, AgentSession, AutoSubscribe, JobContext, WorkerOptions, WorkerType, cli
from livekit.plugins import liveavatar, openai, simli
from backend.runtime.local_env import load_local_env
from openai.types import realtime as openai_realtime

logger = logging.getLogger("nerdy.livekit.avatar_agent")
logger.setLevel(logging.INFO)

load_local_env()

DEFAULT_INSTRUCTIONS = "Talk to me like a clear, encouraging tutor."
DEFAULT_VOICE = "alloy"
DEFAULT_OPENING_LINE = ""
DEFAULT_MIN_INTERRUPTION_DURATION = 1.2
DEFAULT_MIN_INTERRUPTION_WORDS = 2
DEFAULT_FALSE_INTERRUPTION_TIMEOUT = 1.5
DEFAULT_AGENT_FALSE_INTERRUPTION_TIMEOUT = 1.5
DEFAULT_AEC_WARMUP_DURATION = 4.0


def _metadata_float(metadata: dict[str, object], key: str, default: float) -> float:
    raw_value = metadata.get(key, os.getenv(key.upper(), default))
    try:
        return float(raw_value)
    except (TypeError, ValueError):
        return default


def _metadata_int(metadata: dict[str, object], key: str, default: int) -> int:
    raw_value = metadata.get(key, os.getenv(key.upper(), default))
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return default


def _room_metadata(ctx: JobContext) -> dict[str, object]:
    raw_metadata = ctx.room.metadata or "{}"
    try:
        parsed = json.loads(raw_metadata)
    except json.JSONDecodeError:
        logger.warning("invalid room metadata; falling back to defaults")
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _resolve_avatar_session(metadata: dict[str, object]):
    provider = str(metadata.get("provider") or "").strip().lower()

    if provider == "simli":
        face_id = str(metadata.get("face_id") or os.getenv("SIMLI_FACE_ID") or "").strip()
        api_key = os.getenv("SIMLI_API_KEY", "").strip()
        if not api_key or not face_id:
            raise ValueError("Simli sessions require SIMLI_API_KEY and a face_id.")
        return simli.AvatarSession(
            simli_config=simli.SimliConfig(
                api_key=api_key,
                face_id=face_id,
            ),
        )

    if provider == "liveavatar":
        avatar_id = str(
            metadata.get("avatar_id")
            or os.getenv("LIVEAVATAR_AVATAR_ID")
            or os.getenv("HEYGEN_AVATAR_ID")
            or ""
        ).strip()
        api_key = os.getenv("LIVEAVATAR_API_KEY", "").strip() or os.getenv("HEYGEN_API_KEY", "").strip()
        if not api_key or not avatar_id:
            raise ValueError("LiveAvatar sessions require LIVEAVATAR_API_KEY/HEYGEN_API_KEY and an avatar_id.")
        return liveavatar.AvatarSession(
            avatar_id=avatar_id,
            api_key=api_key,
            is_sandbox=bool(metadata.get("is_sandbox", False)),
        )

    raise ValueError(f"unsupported avatar provider: {provider or 'missing'}")


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    metadata = _room_metadata(ctx)
    instructions = str(metadata.get("instructions") or DEFAULT_INSTRUCTIONS).strip() or DEFAULT_INSTRUCTIONS
    voice = str(metadata.get("voice") or DEFAULT_VOICE).strip() or DEFAULT_VOICE
    opening_line = str(metadata.get("opening_line") or os.getenv("NERDY_LIVEKIT_OPENING_LINE") or DEFAULT_OPENING_LINE).strip()
    min_interruption_duration = _metadata_float(metadata, "min_interruption_duration", DEFAULT_MIN_INTERRUPTION_DURATION)
    min_interruption_words = _metadata_int(metadata, "min_interruption_words", DEFAULT_MIN_INTERRUPTION_WORDS)
    false_interruption_timeout = _metadata_float(metadata, "false_interruption_timeout", DEFAULT_FALSE_INTERRUPTION_TIMEOUT)
    agent_false_interruption_timeout = _metadata_float(
        metadata,
        "agent_false_interruption_timeout",
        DEFAULT_AGENT_FALSE_INTERRUPTION_TIMEOUT,
    )
    aec_warmup_duration = _metadata_float(metadata, "aec_warmup_duration", DEFAULT_AEC_WARMUP_DURATION)

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            voice=voice,
            input_audio_noise_reduction="near_field",
            turn_detection=openai_realtime.realtime_audio_input_turn_detection.SemanticVad(
                type="semantic_vad",
                create_response=True,
                eagerness="low",
                interrupt_response=True,
            ),
        ),
        allow_interruptions=True,
        min_interruption_duration=min_interruption_duration,
        min_interruption_words=min_interruption_words,
        false_interruption_timeout=false_interruption_timeout,
        agent_false_interruption_timeout=agent_false_interruption_timeout,
        aec_warmup_duration=aec_warmup_duration,
    )
    avatar_session = _resolve_avatar_session(metadata)
    await avatar_session.start(session, room=ctx.room)
    await session.start(
        agent=Agent(instructions=instructions),
        room=ctx.room,
    )
    if opening_line:
        speech = session.say(
            opening_line,
            add_to_chat_ctx=False,
            allow_interruptions=False,
        )
        await speech.wait_for_playout()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type=WorkerType.ROOM,
            agent_name="nerdy-avatar-agent",
        )
    )
