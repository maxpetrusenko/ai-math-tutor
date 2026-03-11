from __future__ import annotations

import base64
import json
import logging
import os
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.llm.draft_policy import build_draft_tutor_reply
from backend.llm.prompt_builder import build_tutor_messages
from backend.llm.topic_shift import filter_history_for_latest_turn
from backend.llm.provider_switch import ProviderSwitch
from backend.providers import create_provider
from backend.session.firebase_auth import (
    verify_firebase_bearer_token,
    verify_firebase_websocket_token,
)
from backend.session.persistence import (
    archive_lesson_thread,
    clear_active_lesson_thread,
    load_archived_lesson_thread,
    read_lesson_store,
    write_active_lesson_thread,
)
from backend.session.openai_realtime import (
    OpenAIRealtimeClientSecretTimeoutError,
    create_realtime_client_secret,
)
from backend.session.runtime_options import runtime_options_payload, validate_runtime_config
from backend.session.registry import clear_session_snapshot, load_session_snapshot, save_session_snapshot
from backend.session.turn_trace import summarize_latency_tracker, write_turn_trace
from backend.stt.provider import STTProviderFactory, StreamingSTTProvider, StreamingSTTSession
from backend.tts.commit_manager import CommitManager
from backend.tts.provider import TTSProviderFactory
from backend.turn_taking.controller import SessionController

app = FastAPI(title="Nerdy Live Tutor Backend")
logger = logging.getLogger(__name__)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        *[origin.strip() for origin in os.getenv("NERDY_ALLOWED_ORIGINS", "").split(",") if origin.strip()],
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_headers=["*"],
    allow_methods=["*"],
)


def create_stt_provider() -> StreamingSTTProvider:
    return STTProviderFactory().create()


def _auth_namespace(claims: dict[str, object] | None) -> str:
    uid = str((claims or {}).get("uid") or "").strip()
    return uid or "default"


def _is_allowed_websocket_origin(origin: str | None) -> bool:
    if not origin:
        return True

    parsed = urlparse(origin)
    host = parsed.hostname or ""
    if host in {"localhost", "127.0.0.1"}:
        return True

    allowed = {
        entry.strip()
        for entry in os.getenv("NERDY_ALLOWED_ORIGINS", "").split(",")
        if entry.strip()
    }
    return origin in allowed


@app.get("/api/lessons")
def get_lessons(authorization: str | None = Header(default=None)) -> dict[str, object]:
    claims = verify_firebase_bearer_token(authorization)
    return read_lesson_store(namespace=_auth_namespace(claims))


@app.get("/api/runtime-options")
def get_runtime_options() -> dict[str, object]:
    return runtime_options_payload()


@app.post("/api/realtime/client-secret")
def post_realtime_client_secret(
    payload: dict[str, object] | None = None,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    verify_firebase_bearer_token(authorization)
    try:
        return create_realtime_client_secret(payload or {})
    except ValueError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except OpenAIRealtimeClientSecretTimeoutError as error:
        raise HTTPException(status_code=504, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.put("/api/lessons/active")
def put_active_lesson(thread: dict[str, object], authorization: str | None = Header(default=None)) -> dict[str, object]:
    claims = verify_firebase_bearer_token(authorization)
    return write_active_lesson_thread(thread, namespace=_auth_namespace(claims))  # type: ignore[arg-type]


@app.delete("/api/lessons/active")
def delete_active_lesson(authorization: str | None = Header(default=None)) -> dict[str, object]:
    claims = verify_firebase_bearer_token(authorization)
    return clear_active_lesson_thread(namespace=_auth_namespace(claims))


@app.post("/api/lessons/archive")
def post_archived_lesson(entry: dict[str, object], authorization: str | None = Header(default=None)) -> dict[str, object]:
    claims = verify_firebase_bearer_token(authorization)
    return archive_lesson_thread(entry, namespace=_auth_namespace(claims))  # type: ignore[arg-type]


@app.get("/api/lessons/archive/{lesson_id}")
def get_archived_lesson(lesson_id: str, authorization: str | None = Header(default=None)) -> dict[str, object]:
    claims = verify_firebase_bearer_token(authorization)
    thread = load_archived_lesson_thread(lesson_id, namespace=_auth_namespace(claims))
    if thread is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return thread


@app.websocket("/ws/session")
async def session_websocket(websocket: WebSocket) -> None:
    try:
        if not _is_allowed_websocket_origin(websocket.headers.get("origin")):
            raise HTTPException(status_code=403, detail="WebSocket origin not allowed")
        claims = verify_firebase_websocket_token(websocket.query_params.get("auth_token"))
    except HTTPException as error:
        await websocket.close(code=4403 if error.status_code == 403 else 4401)
        return

    await websocket.accept()
    namespace = _auth_namespace(claims)
    session_id = websocket.query_params.get("session_id") or str(uuid4())
    logger.info("session websocket opened %s", _json_summary({"session_id": session_id}))
    controller = SessionController(session_id=session_id)
    snapshot = load_session_snapshot(session_id, namespace=namespace)
    if snapshot is not None:
        controller.restore(snapshot)
    stt_provider = create_stt_provider()
    stt_session: StreamingSTTSession | None = None

    for event in controller.open_session():
        await websocket.send_json(event)

    try:
        while True:
            try:
                message = await websocket.receive_json()
            except WebSocketDisconnect as error:
                logger.warning(
                    "session websocket disconnected %s",
                    _json_summary({"code": error.code, "session_id": session_id}),
                )
                break

            logger.info(
                "session websocket message %s",
                _json_summary(_summarize_browser_message(controller.session_id, message)),
            )
            try:
                events, stt_session = await _handle_message(
                    controller,
                    message,
                    stt_provider,
                    stt_session,
                    namespace=namespace,
                )
            except Exception as error:
                logger.exception(
                    "session websocket message failed %s",
                    _json_summary(_summarize_browser_message(controller.session_id, message)),
                )
                await websocket.send_json({"type": "session.error", "detail": str(error)})
                break
            for event in events:
                await websocket.send_json(event)
    finally:
        if stt_session is not None:
            logger.info("session websocket closing stt session %s", _json_summary({"session_id": session_id}))
            await stt_session.close()


async def _handle_message(
    controller: SessionController,
    message: dict[str, object],
    stt_provider: StreamingSTTProvider,
    stt_session: StreamingSTTSession | None,
    *,
    namespace: str = "default",
) -> tuple[list[dict[str, object]], StreamingSTTSession | None]:
    message_type = message["type"]

    if message_type == "audio.chunk":
        events = controller.handle_audio_chunk(
            sequence=int(message["sequence"]),
            size=int(message["size"]),
        )
        logger.info(
            "session websocket audio chunk %s",
            _json_summary(_summarize_browser_message(controller.session_id, message)),
        )
        chunk_b64 = str(message.get("bytes_b64") or "").strip()
        if not chunk_b64:
            return events, stt_session

        if stt_session is None:
            logger.info(
                "session websocket opening stt session %s",
                _json_summary({"session_id": controller.session_id}),
            )
            stt_session = await stt_provider.open_session(controller.latency_tracker)

        audio_bytes = base64.b64decode(chunk_b64)
        logger.info(
            "session websocket audio decoded %s",
            _json_summary(
                {
                    "decoded_bytes": len(audio_bytes),
                    "mime_type": str(message.get("mime_type") or "") or None,
                    "sequence": int(message["sequence"]),
                    "session_id": controller.session_id,
                    "size": int(message["size"]),
                }
            ),
        )
        chunk_ts_ms = float(message.get("ts_ms")) if message.get("ts_ms") is not None else None
        transcript_events = await stt_session.push_audio(audio_bytes, ts_ms=chunk_ts_ms)
        events.extend(transcript_events)
        return events, stt_session
    if message_type == "speech.end":
        speech_end_ts_ms = float(message["ts_ms"])
        events = controller.handle_speech_end(ts_ms=speech_end_ts_ms)
        transcript_events: list[dict[str, object]] = []
        transcript_text = ""
        transcript_source = "missing"
        transcribe_only = bool(message.get("transcribe_only"))
        trace_turn_id = str(message.get("turn_id") or uuid4())
        logger.info(
            "session speech.end received %s",
            _json_summary(
                {
                    "has_stt_session": stt_session is not None,
                    "session_id": controller.session_id,
                    "text_length": len(str(message.get("text") or "")),
                    "transcribe_only": transcribe_only,
                    "ts_ms": speech_end_ts_ms,
                }
            ),
        )
        if stt_session is not None:
            logger.info(
                "session stt.finalize start %s",
                _json_summary({"session_id": controller.session_id, "ts_ms": speech_end_ts_ms + 120}),
            )
            transcript_events = [
                event
                for event in await stt_session.finalize(ts_ms=speech_end_ts_ms + 120)
                if not _is_empty_transcript_event(event)
            ]
            final_transcript = _latest_transcript_for_type(transcript_events, "transcript.final")
            stable_partial_transcript = _latest_transcript_for_type(transcript_events, "transcript.partial_stable")
            logger.info(
                "session stt.finalize end %s",
                _json_summary(
                    {
                        "event_count": len(transcript_events),
                        "event_types": _summarize_transcript_event_types(transcript_events),
                        "final_transcript_length": len(final_transcript),
                        "has_final": bool(final_transcript),
                        "has_partial_stable": bool(stable_partial_transcript),
                        "partial_stable_length": len(stable_partial_transcript),
                        "session_id": controller.session_id,
                        "transcribe_only": transcribe_only,
                    }
                ),
            )
            events.extend(transcript_events)
            transcript_text = final_transcript
            if not transcript_text and transcribe_only and stable_partial_transcript:
                transcript_text = stable_partial_transcript
                events.append({"type": "transcript.final", "text": transcript_text})
            await stt_session.close()
            stt_session = None
            if transcript_text:
                transcript_source = "stt_final" if final_transcript else "stt_partial_stable"

        if not transcript_text:
            transcript_text = str(message.get("text", "")).strip()
            if transcript_text:
                tracker = controller.latency_tracker
                tracker.mark("stt_final", speech_end_ts_ms, {"provider": "text_fallback"})
                events.append({"type": "transcript.final", "text": transcript_text})
                transcript_source = "text_fallback"
        _log_transcript_resolution(
            session_id=controller.session_id,
            source=transcript_source,
            transcript_text=transcript_text,
        )
        if not transcript_text:
            _write_speech_end_trace(
                controller=controller,
                turn_id=trace_turn_id,
                transcript_source=transcript_source,
                transcript_text=transcript_text,
                transcript_events=transcript_events,
                transcribe_only=transcribe_only,
            )
            events.append({"type": "session.error", "detail": "No speech detected"})
            events.extend(controller.abandon_turn())
            return events, stt_session

        if transcribe_only:
            _write_speech_end_trace(
                controller=controller,
                turn_id=trace_turn_id,
                transcript_source=transcript_source,
                transcript_text=transcript_text,
                transcript_events=transcript_events,
                transcribe_only=transcribe_only,
            )
            events.extend(controller.abandon_turn())
            return events, stt_session

        controller.subject = str(message.get("subject") or controller.subject)
        controller.grade_band = str(message.get("grade_band") or controller.grade_band)
        raw_profile = message.get("student_profile")
        if isinstance(raw_profile, dict):
            controller.student_profile.update(
                {
                    str(key): str(value)
                    for key, value in raw_profile.items()
                    if value is not None and str(value).strip()
                }
            )

        tracker = controller.latency_tracker
        try:
            runtime_config = validate_runtime_config(message)
        except ValueError as error:
            events.append({"type": "session.error", "detail": str(error)})
            events.extend(controller.abandon_turn())
            return events, stt_session
        relevant_history = filter_history_for_latest_turn(
            subject=controller.subject,
            latest_student_text=transcript_text,
            history=controller.history,
        )
        messages = build_tutor_messages(
            subject=controller.subject,
            grade_band=controller.grade_band,
            latest_student_text=transcript_text,
            history=relevant_history,
            student_profile=controller.student_profile,
        )
        provider_switch = ProviderSwitch(
            primary=create_provider("llm", runtime_config["llm_provider"]),
            fallback=create_provider("llm", os.getenv("NERDY_RUNTIME_LLM_FALLBACK_PROVIDER", "minimax")),
        )
        draft_reply = build_draft_tutor_reply(
            subject=controller.subject,
            grade_band=controller.grade_band,
            latest_student_text=transcript_text,
            student_profile=controller.student_profile,
            history=relevant_history,
        )
        logger.info(
            "session llm start %s",
            _json_summary(
                {
                    "llm_model": runtime_config["llm_model"],
                    "llm_provider": runtime_config["llm_provider"],
                    "session_id": controller.session_id,
                    "transcript_length": len(transcript_text),
                }
            ),
        )
        llm_result = provider_switch.stream_response(
            messages=messages,
            token_stream=[draft_reply],
            tracker=tracker,
            first_token_ts_ms=speech_end_ts_ms,
            use_fallback=bool(message.get("use_fallback", False)),
            options={"model": runtime_config["llm_model"]},
        )
        logger.info(
            "session llm end %s",
            _json_summary(
                {
                    "response_length": len(str(llm_result.get("text") or "")),
                    "session_id": controller.session_id,
                }
            ),
        )
        turn_id = str(uuid4())
        events.extend(controller.begin_tutor_turn(turn_id=turn_id))

        commit_manager = CommitManager(mode="phrase")
        commit_manager.push_token(llm_result["text"])
        committed_chunks = commit_manager.finish_turn()

        tts_factory = TTSProviderFactory()
        try:
            tts_provider = tts_factory.create(runtime_config["tts_provider"])
        except ValueError as error:
            events.append({"type": "session.error", "detail": str(error)})
            return events, stt_session
        voice_config = tts_factory.default_voice_config(runtime_config["tts_provider"])
        raw_voice_config = message.get("voice_config")
        if isinstance(raw_voice_config, dict):
            voice_config.update(
                {
                    str(key): str(value)
                    for key, value in raw_voice_config.items()
                    if value is not None and str(value).strip()
                }
            )
        events.append(tts_provider.start_context(turn_id=turn_id, voice_config=voice_config))
        logger.info(
            "session tts start %s",
            _json_summary(
                {
                    "chunk_count": len(committed_chunks),
                    "session_id": controller.session_id,
                    "tts_model": runtime_config["tts_model"],
                    "tts_provider": runtime_config["tts_provider"],
                }
            ),
        )

        tts_trace_chunks: list[dict[str, object]] = []
        for index, chunk in enumerate(committed_chunks):
            events.append({"type": "tutor.text.committed", "text": chunk})
            tts_event = tts_provider.send_phrase(
                chunk,
                tracker=tracker,
                first_audio_ts_ms=speech_end_ts_ms,
                is_final=index == len(committed_chunks) - 1,
                options={"model": runtime_config["tts_model"]},
            )
            events.append(tts_event)
            tts_trace_chunks.append(
                {
                    "event_type": str(tts_event.get("type") or ""),
                    "is_final": bool(tts_event.get("is_final")),
                    "model": str(tts_event.get("model") or runtime_config["tts_model"]),
                    "provider": str(tts_event.get("provider") or runtime_config["tts_provider"]),
                    "text": chunk,
                    "timestamp_count": len(tts_event.get("timestamps", [])) if isinstance(tts_event.get("timestamps"), list) else 0,
                }
            )
        events.append(tts_provider.flush())
        logger.info(
            "session tts end %s",
            _json_summary({"chunk_count": len(committed_chunks), "session_id": controller.session_id}),
        )
        controller.history.extend(
            [
                {"role": "user", "content": transcript_text},
                {"role": "assistant", "content": llm_result["text"]},
            ]
        )
        write_turn_trace(
            {
                "session_id": controller.session_id,
                "turn_id": trace_turn_id,
                "subject": controller.subject,
                "grade_band": controller.grade_band,
                "student_profile": controller.student_profile,
                "runtime_config": runtime_config,
                "stt": {
                    "source": transcript_source,
                    "transcript_text": transcript_text,
                    "transcript_length": len(transcript_text),
                },
                "llm": {
                    "messages": messages,
                    "result": llm_result,
                    "token_stream": [draft_reply],
                },
                "tts": {
                    "provider": runtime_config["tts_provider"],
                    "voice_config": voice_config,
                    "chunks": tts_trace_chunks,
                },
                "latency": summarize_latency_tracker(tracker),
            }
        )
        save_session_snapshot(controller.session_id, controller.snapshot(), namespace=namespace)
        return events, stt_session
    if message_type == "tutor.turn.start":
        return controller.begin_tutor_turn(turn_id=str(message["turn_id"])), stt_session
    if message_type == "tutor.turn.end":
        return controller.complete_tutor_turn(turn_id=str(message["turn_id"])), stt_session
    if message_type == "interrupt":
        return controller.interrupt(), stt_session
    if message_type == "session.restore":
        raw_history = message.get("history")
        raw_student_profile = message.get("student_profile")
        history = []
        if isinstance(raw_history, list):
            history = [
                {
                    "content": str(item.get("content", "")),
                    "role": str(item.get("role", "")),
                }
                for item in raw_history
                if isinstance(item, dict)
            ]
        student_profile: dict[str, str] = {}
        if isinstance(raw_student_profile, dict):
            student_profile = {
                str(key): str(value)
                for key, value in raw_student_profile.items()
                if value is not None and str(value).strip()
            }
        snapshot = {
            "grade_band": str(message.get("grade_band") or "6-8"),
            "history": history,
            "student_profile": student_profile,
            "subject": str(message.get("subject") or "general"),
        }
        save_session_snapshot(controller.session_id, snapshot, namespace=namespace)
        return controller.restore(snapshot), stt_session
    if message_type == "session.reset":
        if stt_session is not None:
            await stt_session.close()
            stt_session = None
        clear_session_snapshot(controller.session_id, namespace=namespace)
        return controller.reset(), stt_session
    return [{"type": "session.error", "detail": f"unknown message type: {message_type}"}], stt_session


def _log_transcript_resolution(*, session_id: str, source: str, transcript_text: str) -> None:
    details = {
        "session_id": session_id,
        "source": source,
        "text_length": len(transcript_text),
        "text_preview": transcript_text[:120],
    }
    if transcript_text:
        logger.info("session transcript resolved %s", _json_summary(details))
        return

    logger.warning("session transcript missing %s", _json_summary(details))


def _is_empty_transcript_event(event: dict[str, object]) -> bool:
    return event.get("type") == "transcript.final" and not str(event.get("text", "")).strip()


def _latest_final_transcript(events: list[dict[str, object]]) -> str:
    return _latest_transcript_for_type(events, "transcript.final")


def _latest_transcript_for_type(events: list[dict[str, object]], event_type: str) -> str:
    for event in reversed(events):
        if event.get("type") == event_type:
            return str(event.get("text", "")).strip()
    return ""


def _summarize_transcript_event_types(events: list[dict[str, object]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for event in events:
        event_type = str(event.get("type") or "unknown")
        counts[event_type] = counts.get(event_type, 0) + 1
    return counts


def _write_speech_end_trace(
    *,
    controller: SessionController,
    turn_id: str,
    transcript_source: str,
    transcript_text: str,
    transcript_events: list[dict[str, object]],
    transcribe_only: bool,
) -> None:
    write_turn_trace(
        {
            "session_id": controller.session_id,
            "turn_id": turn_id,
            "subject": controller.subject,
            "grade_band": controller.grade_band,
            "student_profile": controller.student_profile,
            "stt": {
                "event_count": len(transcript_events),
                "event_types": _summarize_transcript_event_types(transcript_events),
                "source": transcript_source,
                "transcribe_only": transcribe_only,
                "transcript_length": len(transcript_text),
                "transcript_text": transcript_text,
            },
            "latency": summarize_latency_tracker(controller.latency_tracker),
        }
    )


def _json_summary(payload: dict[str, object]) -> str:
    return json.dumps(payload, default=str, sort_keys=True)


def _summarize_browser_message(session_id: str, message: dict[str, object]) -> dict[str, object]:
    summary: dict[str, object] = {
        "session_id": session_id,
        "type": str(message.get("type") or "unknown"),
    }

    if summary["type"] == "audio.chunk":
        chunk_b64 = str(message.get("bytes_b64") or "").strip()
        summary.update(
            {
                "bytes_b64_length": len(chunk_b64),
                "mime_type": str(message.get("mime_type") or "") or None,
                "sequence": int(message.get("sequence") or 0),
                "size": int(message.get("size") or 0),
                "ts_ms": float(message.get("ts_ms") or 0) or None,
            }
        )
    elif summary["type"] == "speech.end":
        raw_profile = message.get("student_profile")
        summary.update(
            {
                "grade_band": str(message.get("grade_band") or ""),
                "student_profile_keys": list(raw_profile.keys()) if isinstance(raw_profile, dict) else [],
                "subject": str(message.get("subject") or ""),
                "text_length": len(str(message.get("text") or "")),
                "ts_ms": float(message.get("ts_ms") or 0),
            }
        )
    elif summary["type"] == "session.restore":
        raw_history = message.get("history")
        raw_profile = message.get("student_profile")
        summary.update(
            {
                "grade_band": str(message.get("grade_band") or ""),
                "history_length": len(raw_history) if isinstance(raw_history, list) else 0,
                "student_profile_keys": list(raw_profile.keys()) if isinstance(raw_profile, dict) else [],
                "subject": str(message.get("subject") or ""),
            }
        )

    return summary
