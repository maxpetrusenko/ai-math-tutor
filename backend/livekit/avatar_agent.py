from __future__ import annotations

import asyncio
import json
import logging
import os
import time

from livekit import rtc
from livekit.agents import Agent, AgentSession, AutoSubscribe, JobContext, RoomInputOptions, RoomOutputOptions, WorkerOptions, WorkerType, cli
from livekit.plugins import liveavatar, openai, simli
from backend.livekit.avatar_bootstrap import serialize_simli_face_id
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
DEFAULT_AEC_WARMUP_DURATION = 0.0
DEFAULT_AVATAR_MEDIA_TIMEOUT = 25.0
AGENT_READY_TOPIC = "nerdy.avatar_agent"
AGENT_READY_TYPE = "nerdy.avatar_agent.ready"


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


class _OptionalEmotionSimliConfig(simli.SimliConfig):
    def create_json(self) -> dict[str, object]:
        result = super().create_json()
        result["faceId"] = serialize_simli_face_id(self.face_id, self.emotion_id)
        return result


def _build_simli_config(*, api_key: str, face_id: str, emotion_id: str | None) -> simli.SimliConfig:
    return _OptionalEmotionSimliConfig(
        api_key=api_key,
        face_id=face_id,
        emotion_id=(emotion_id or "").strip(),
    )


def _resolve_avatar_session(metadata: dict[str, object]):
    provider = str(metadata.get("provider") or "").strip().lower()
    avatar_participant_identity = str(metadata.get("avatar_participant_identity") or "").strip()

    if provider == "simli":
        face_id = str(metadata.get("face_id") or os.getenv("SIMLI_FACE_ID") or "").strip()
        api_key = os.getenv("SIMLI_API_KEY", "").strip()
        if not api_key or not face_id:
            raise ValueError("Simli sessions require SIMLI_API_KEY and a face_id.")
        emotion_id = str(metadata.get("emotion_id") or "").strip()
        return simli.AvatarSession(
            simli_config=_build_simli_config(
                api_key=api_key,
                face_id=face_id,
                emotion_id=emotion_id,
            ),
            **({"avatar_participant_identity": avatar_participant_identity} if avatar_participant_identity else {}),
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
            **({"avatar_participant_identity": avatar_participant_identity} if avatar_participant_identity else {}),
        )

    raise ValueError(f"unsupported avatar provider: {provider or 'missing'}")


def _audio_output_chain(output: object) -> list[str]:
    chain: list[str] = []
    current = output
    while current is not None:
        label = getattr(current, "label", current.__class__.__name__)
        chain.append(str(label))
        current = getattr(current, "next_in_chain", None)
    return chain


def _publication_kind_label(publication: object) -> str:
    kind = getattr(publication, "kind", None)
    if kind == rtc.TrackKind.KIND_AUDIO:
        return "audio"
    if kind == rtc.TrackKind.KIND_VIDEO:
        return "video"
    return str(kind or "unknown")


def _collect_avatar_media(room: rtc.Room, avatar_identity: str) -> set[str]:
    participant = room.remote_participants.get(avatar_identity)
    if not participant:
        return set()

    return {
        _publication_kind_label(publication)
        for publication in participant.track_publications.values()
        if not getattr(publication, "muted", False)
    }


async def _wait_for_avatar_media(room: rtc.Room, avatar_identity: str, timeout: float) -> set[str]:
    if not avatar_identity:
        raise RuntimeError("avatar_participant_identity is required for managed avatar sessions.")

    media_ready = asyncio.Event()

    def maybe_mark_ready() -> None:
        media = _collect_avatar_media(room, avatar_identity)
        if {"audio", "video"}.issubset(media):
            media_ready.set()

    def on_participant_connected(participant: rtc.RemoteParticipant) -> None:
        logger.info(
            "avatar room participant connected",
            extra={"participant_identity": participant.identity, "expected_avatar_identity": avatar_identity},
        )
        maybe_mark_ready()

    def on_track_published(publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant) -> None:
        logger.info(
            "avatar room track published",
            extra={
                "participant_identity": participant.identity,
                "expected_avatar_identity": avatar_identity,
                "kind": _publication_kind_label(publication),
                "track_name": getattr(publication, "name", ""),
                "source": str(getattr(publication, "source", "")),
            },
        )
        maybe_mark_ready()

    def on_track_unpublished(publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant) -> None:
        logger.warning(
            "avatar room track unpublished",
            extra={
                "participant_identity": participant.identity,
                "expected_avatar_identity": avatar_identity,
                "kind": _publication_kind_label(publication),
                "track_name": getattr(publication, "name", ""),
            },
        )

    room.on("participant_connected", on_participant_connected)
    room.on("track_published", on_track_published)
    room.on("track_unpublished", on_track_unpublished)
    try:
        maybe_mark_ready()
        await asyncio.wait_for(media_ready.wait(), timeout=timeout)
        return _collect_avatar_media(room, avatar_identity)
    except asyncio.TimeoutError as exc:
        participants = sorted(room.remote_participants.keys())
        avatar_media = sorted(_collect_avatar_media(room, avatar_identity))
        logger.error(
            "avatar media did not become ready",
            extra={
                "room": room.name,
                "expected_avatar_identity": avatar_identity,
                "remote_participants": participants,
                "avatar_media": avatar_media,
                "timeout": timeout,
            },
        )
        raise RuntimeError("Avatar provider did not publish synchronized audio and video in time.") from exc
    finally:
        room.off("participant_connected", on_participant_connected)
        room.off("track_published", on_track_published)
        room.off("track_unpublished", on_track_unpublished)


def _attach_session_logging(session: AgentSession) -> None:
    session.on(
        "agent_state_changed",
        lambda event: logger.info(
            "avatar agent state changed",
            extra={"old_state": event.old_state, "new_state": event.new_state},
        ),
    )
    session.on(
        "user_input_transcribed",
        lambda event: logger.info(
            "avatar user input transcribed",
            extra={"is_final": event.is_final, "transcript": event.transcript},
        ),
    )
    session.on(
        "conversation_item_added",
        lambda event: logger.info(
            "avatar conversation item added",
            extra={
                "role": getattr(event.item, "role", "unknown"),
                "text": str(getattr(event.item, "text_content", "") or "")[:300],
            },
        ),
    )
    session.on(
        "speech_created",
        lambda event: logger.info(
            "avatar speech created",
            extra={"source": event.source, "user_initiated": event.user_initiated},
        ),
    )
    session.on(
        "metrics_collected",
        lambda event: logger.info(
            "avatar metrics collected",
            extra={
                "metrics": (
                    event.metrics.model_dump(mode="json")
                    if hasattr(event.metrics, "model_dump")
                    else str(event.metrics)
                )
            },
        ),
    )
    session.on(
        "error",
        lambda event: logger.error(
            "avatar session error",
            extra={"error": str(getattr(event, "error", event))},
        ),
    )


async def _publish_agent_ready(ctx: JobContext, student_identity: str) -> None:
    payload = json.dumps(
        {
            "type": AGENT_READY_TYPE,
            "room": ctx.room.name,
            "ready_at": time.time(),
        }
    )
    destinations = [student_identity] if student_identity else []
    try:
        await ctx.room.local_participant.publish_data(
            payload,
            reliable=True,
            destination_identities=destinations,
            topic=AGENT_READY_TOPIC,
        )
        logger.info(
            "avatar agent ready published",
            extra={"room": ctx.room.name, "student_identity": student_identity or "broadcast"},
        )
    except Exception:
        logger.exception(
            "failed to publish avatar agent ready",
            extra={"room": ctx.room.name, "student_identity": student_identity or "broadcast"},
        )


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    metadata = _room_metadata(ctx)
    instructions = str(metadata.get("instructions") or DEFAULT_INSTRUCTIONS).strip() or DEFAULT_INSTRUCTIONS
    voice = str(metadata.get("voice") or DEFAULT_VOICE).strip() or DEFAULT_VOICE
    student_identity = str(metadata.get("student_identity") or "").strip()
    avatar_identity = str(metadata.get("avatar_participant_identity") or "").strip()
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
                eagerness="high",
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
    _attach_session_logging(session)
    avatar_session = _resolve_avatar_session(metadata)
    await avatar_session.start(session, room=ctx.room)
    try:
        avatar_media = await _wait_for_avatar_media(
            ctx.room,
            avatar_identity,
            _metadata_float(metadata, "avatar_media_timeout", DEFAULT_AVATAR_MEDIA_TIMEOUT),
        )
    except RuntimeError:
        await ctx.room.disconnect()
        return

    room_input_options = (
        RoomInputOptions(
            participant_identity=student_identity,
            pre_connect_audio_timeout=10.0,
        )
        if student_identity
        else None
    )
    logger.info(
        "starting avatar agent session",
        extra={
            "room": ctx.room.name,
            "student_identity": student_identity or "auto",
            "avatar_identity": avatar_identity,
            "avatar_media": sorted(avatar_media),
            "voice": voice,
        },
    )
    await session.start(
        agent=Agent(instructions=instructions),
        room=ctx.room,
        room_output_options=RoomOutputOptions(audio_enabled=False),
        **({"room_input_options": room_input_options} if room_input_options else {}),
    )
    logger.info(
        "avatar agent session started",
        extra={"audio_output_chain": _audio_output_chain(session.output.audio)},
    )
    await _publish_agent_ready(ctx, student_identity)
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
