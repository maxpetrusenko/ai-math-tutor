from __future__ import annotations

import base64
from uuid import uuid4

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from backend.llm.draft_policy import build_draft_tutor_reply
from backend.llm.prompt_builder import build_tutor_messages
from backend.llm.provider_switch import ProviderSwitch
from backend.stt.provider import STTProviderFactory, StreamingSTTProvider, StreamingSTTSession
from backend.tts.commit_manager import CommitManager
from backend.tts.provider import TTSProviderFactory
from backend.turn_taking.controller import SessionController

app = FastAPI(title="Nerdy Live Tutor Backend")


def create_stt_provider() -> StreamingSTTProvider:
    return STTProviderFactory().create()


@app.websocket("/ws/session")
async def session_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    controller = SessionController(session_id=str(uuid4()))
    stt_provider = create_stt_provider()
    stt_session: StreamingSTTSession | None = None

    for event in controller.open_session():
        await websocket.send_json(event)

    try:
        while True:
            try:
                message = await websocket.receive_json()
            except WebSocketDisconnect:
                break

            events, stt_session = await _handle_message(controller, message, stt_provider, stt_session)
            for event in events:
                await websocket.send_json(event)
    finally:
        if stt_session is not None:
            await stt_session.close()


async def _handle_message(
    controller: SessionController,
    message: dict[str, object],
    stt_provider: StreamingSTTProvider,
    stt_session: StreamingSTTSession | None,
) -> tuple[list[dict[str, object]], StreamingSTTSession | None]:
    message_type = message["type"]

    if message_type == "audio.chunk":
        events = controller.handle_audio_chunk(
            sequence=int(message["sequence"]),
            size=int(message["size"]),
        )
        chunk_b64 = str(message.get("bytes_b64") or "").strip()
        if not chunk_b64:
            return events, stt_session

        if stt_session is None:
            stt_session = await stt_provider.open_session(controller.latency_tracker)

        audio_bytes = base64.b64decode(chunk_b64)
        transcript_events = await stt_session.push_audio(audio_bytes)
        events.extend(transcript_events)
        return events, stt_session
    if message_type == "speech.end":
        events = controller.handle_speech_end(ts_ms=float(message["ts_ms"]))
        transcript_text = ""
        if stt_session is not None:
            transcript_events = await stt_session.finalize(ts_ms=float(message["ts_ms"]) + 120)
            events.extend(transcript_events)
            transcript_text = _latest_final_transcript(transcript_events)
            await stt_session.close()
            stt_session = None

        if not transcript_text:
            transcript_text = str(message.get("text", "")).strip()
            if transcript_text:
                tracker = controller.latency_tracker
                tracker.mark("stt_final", float(message["ts_ms"]), {"provider": "text_fallback"})
                events.append({"type": "transcript.final", "text": transcript_text})
        if not transcript_text:
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
        messages = build_tutor_messages(
            subject=controller.subject,
            grade_band=controller.grade_band,
            latest_student_text=transcript_text,
            history=controller.history,
            student_profile=controller.student_profile,
        )
        provider_switch = ProviderSwitch()
        llm_result = provider_switch.stream_response(
            messages=messages,
            token_stream=[
                build_draft_tutor_reply(
                    subject=controller.subject,
                    grade_band=controller.grade_band,
                    latest_student_text=transcript_text,
                    student_profile=controller.student_profile,
                )
            ],
            tracker=tracker,
            first_token_ts_ms=float(message["ts_ms"]) + 260,
            use_fallback=bool(message.get("use_fallback", False)),
        )
        turn_id = str(uuid4())
        events.extend(controller.begin_tutor_turn(turn_id=turn_id))

        commit_manager = CommitManager(mode="phrase")
        commit_manager.push_token(llm_result["text"])
        committed_chunks = commit_manager.finish_turn()

        tts_factory = TTSProviderFactory()
        try:
            tts_provider = tts_factory.create(message.get("tts_provider"))
        except ValueError as error:
            events.append({"type": "session.error", "detail": str(error)})
            return events, stt_session
        voice_config = tts_factory.default_voice_config(message.get("tts_provider"))
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

        for index, chunk in enumerate(committed_chunks):
            events.append({"type": "tutor.text.committed", "text": chunk})
            events.append(
                tts_provider.send_phrase(
                    chunk,
                    tracker=tracker,
                    first_audio_ts_ms=float(message["ts_ms"]) + 380,
                    is_final=index == len(committed_chunks) - 1,
                )
            )
        events.append(tts_provider.flush())
        controller.history.extend(
            [
                {"role": "user", "content": transcript_text},
                {"role": "assistant", "content": llm_result["text"]},
            ]
        )
        return events, stt_session
    if message_type == "tutor.turn.start":
        return controller.begin_tutor_turn(turn_id=str(message["turn_id"])), stt_session
    if message_type == "tutor.turn.end":
        return controller.complete_tutor_turn(turn_id=str(message["turn_id"])), stt_session
    if message_type == "interrupt":
        return controller.interrupt(), stt_session
    return [{"type": "session.error", "detail": f"unknown message type: {message_type}"}], stt_session
def _latest_final_transcript(events: list[dict[str, object]]) -> str:
    for event in reversed(events):
        if event.get("type") == "transcript.final":
            return str(event.get("text", "")).strip()
    return ""
