from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlencode

from websockets.asyncio.client import connect as websocket_connect
from websockets.exceptions import ConnectionClosed

from backend.ai.call_logging import run_logged_ai_call_async
from backend.monitoring.latency_tracker import LatencyTracker
from backend.runtime.local_env import load_local_env
from backend.stt.provider import StreamingSTTSession, TranscriptEvent
from backend.turn_taking.transcript_commit import TranscriptCommitter

_DEEPGRAM_LISTEN_URL = "wss://api.deepgram.com/v1/listen"
logger = logging.getLogger(__name__)
_DEEPGRAM_PARTIAL_POLL_TIMEOUT_S = 0.01
_DEEPGRAM_FINALIZE_WAIT_TIMEOUT_S = 1.5


class DeepgramConnection(Protocol):
    async def send_bytes(self, chunk: bytes) -> None: ...

    async def send_json(self, payload: dict[str, object]) -> None: ...

    async def recv_json(self) -> dict[str, object]: ...

    async def close(self) -> None: ...


class DeepgramTransport(Protocol):
    async def connect(self, api_key: str, url: str) -> DeepgramConnection: ...


@dataclass(slots=True)
class DeepgramConfig:
    api_key: str | None
    model: str = "nova-3"
    fallback_model: str = "nova-3"
    language: str = "en"
    endpointing_ms: int = 300
    interim_results: bool = True
    punctuate: bool = True
    smart_format: bool = True


class WebSocketDeepgramConnection:
    def __init__(self, websocket: object) -> None:
        self._websocket = websocket

    async def send_bytes(self, chunk: bytes) -> None:
        await self._websocket.send(chunk)

    async def send_json(self, payload: dict[str, object]) -> None:
        await self._websocket.send(json.dumps(payload))

    async def recv_json(self) -> dict[str, object]:
        payload = await self._websocket.recv()
        if isinstance(payload, bytes):
            payload = payload.decode("utf-8")
        data = json.loads(payload)
        if not isinstance(data, dict):
            raise ValueError("expected Deepgram payload object")
        return data

    async def close(self) -> None:
        await self._websocket.close()


class WebSocketDeepgramTransport:
    async def connect(self, api_key: str, url: str) -> DeepgramConnection:
        websocket = await websocket_connect(
            url,
            additional_headers={"Authorization": f"Token {api_key}"},
        )
        return WebSocketDeepgramConnection(websocket)


class DeepgramStreamingClient:
    def __init__(
        self,
        api_key: str | None = None,
        *,
        stability_repeats: int = 2,
        model: str = "nova-3",
        fallback_model: str = "nova-3",
        transport: DeepgramTransport | None = None,
    ) -> None:
        self.config = DeepgramConfig(
            api_key=api_key if api_key is not None else os.getenv("DEEPGRAM_API_KEY"),
            model=model,
            fallback_model=fallback_model,
        )
        self.stability_repeats = stability_repeats
        self.transport = transport or WebSocketDeepgramTransport()

    async def open_session(self, tracker: LatencyTracker) -> StreamingSTTSession:
        api_key = self.config.api_key
        if not api_key:
            load_local_env()
            api_key = os.getenv("DEEPGRAM_API_KEY")
            self.config.api_key = api_key
        if not api_key:
            raise RuntimeError("DEEPGRAM_API_KEY is required for audio streaming STT")

        url = _build_listen_url(self.config)
        logger.info(
            "deepgram session opening %s",
            _json_summary({"model": self.config.model, "url": url}),
        )
        connection = await run_logged_ai_call_async(
            logger=logger,
            provider="deepgram",
            operation="stt.open_session",
            request_payload={"model": self.config.model, "url": url},
            call=lambda: self.transport.connect(api_key, url),
            response_summarizer=lambda _connection: {"session": "opened", "model": self.config.model},
        )
        return DeepgramStreamingSession(
            connection=connection,
            tracker=tracker,
            stability_repeats=self.stability_repeats,
            model=self.config.model,
        )


class DeepgramStreamingSession:
    def __init__(
        self,
        *,
        connection: DeepgramConnection,
        tracker: LatencyTracker,
        stability_repeats: int,
        model: str,
    ) -> None:
        self._connection = connection
        self._tracker = tracker
        self._committer = TranscriptCommitter(stability_repeats=stability_repeats)
        self._model = model
        self._chunk_count = 0
        self._audio_bytes_sent = 0
        self._last_chunk_ts_ms: float | None = None

    async def push_audio(self, chunk: bytes, *, ts_ms: float | None = None) -> list[TranscriptEvent]:
        logger.info(
            "deepgram audio send %s",
            _json_summary({"chunk_bytes": len(chunk), "ts_ms": ts_ms}),
        )
        chunk_delta_ms = round(ts_ms - self._last_chunk_ts_ms, 1) if ts_ms is not None and self._last_chunk_ts_ms is not None else None
        return await run_logged_ai_call_async(
            logger=logger,
            provider="deepgram",
            operation="stt.push_audio",
            request_payload={
                "chunk": chunk,
                "chunk_bytes": len(chunk),
                "chunk_delta_ms": chunk_delta_ms,
                "chunk_index": self._chunk_count + 1,
                "model": self._model,
                "total_audio_bytes_after_send": self._audio_bytes_sent + len(chunk),
                "ts_ms": ts_ms,
            },
            call=lambda: self._push_audio_impl(chunk, ts_ms=ts_ms),
            response_summarizer=_summarize_transcript_events,
        )

    async def finalize(self, *, ts_ms: float) -> list[TranscriptEvent]:
        payload = {"type": "Finalize"}
        logger.info(
            "deepgram control send %s",
            _json_summary({"control_type": payload["type"], "ts_ms": ts_ms}),
        )
        return await run_logged_ai_call_async(
            logger=logger,
            provider="deepgram",
            operation="stt.finalize",
            request_payload={"payload": payload, "ts_ms": ts_ms},
            call=lambda: self._finalize_impl(payload, ts_ms=ts_ms),
            response_summarizer=_summarize_transcript_events,
        )

    async def _push_audio_impl(self, chunk: bytes, *, ts_ms: float | None) -> list[TranscriptEvent]:
        self._chunk_count += 1
        self._audio_bytes_sent += len(chunk)
        self._last_chunk_ts_ms = ts_ms
        try:
            await self._connection.send_bytes(chunk)
        except ConnectionClosed as error:
            raise RuntimeError(_format_connection_closed(error)) from error
        return await self._drain_events(ts_ms=ts_ms)

    async def _finalize_impl(self, payload: dict[str, object], *, ts_ms: float) -> list[TranscriptEvent]:
        try:
            await self._connection.send_json(payload)
        except ConnectionClosed as error:
            raise RuntimeError(_format_connection_closed(error)) from error
        return await self._drain_events(ts_ms=ts_ms, stop_on_final=True)

    async def close(self) -> None:
        logger.info("deepgram session closing %s", _json_summary({"model": self._model}))
        try:
            await self._connection.close()
        except ConnectionClosed:
            return

    async def _drain_events(
        self,
        *,
        ts_ms: float | None,
        stop_on_final: bool = False,
    ) -> list[TranscriptEvent]:
        events: list[TranscriptEvent] = []
        deadline = time.monotonic() + _DEEPGRAM_FINALIZE_WAIT_TIMEOUT_S if stop_on_final else None

        while True:
            timeout = _DEEPGRAM_PARTIAL_POLL_TIMEOUT_S
            if stop_on_final:
                assert deadline is not None
                remaining_s = deadline - time.monotonic()
                if remaining_s <= 0:
                    break
                timeout = remaining_s
            try:
                payload = await asyncio.wait_for(self._connection.recv_json(), timeout=timeout)
            except TimeoutError:
                break
            except ConnectionClosed as error:
                raise RuntimeError(_format_connection_closed(error)) from error

            logger.info("deepgram payload received %s", _json_summary(_summarize_payload(payload)))

            event = self._handle_message(payload, ts_ms=ts_ms)
            if event is None:
                continue

            events.append(event)
            if stop_on_final and event["type"] == "transcript.final":
                break

        return events

    def _handle_message(self, payload: dict[str, object], *, ts_ms: float | None) -> TranscriptEvent | None:
        if payload.get("type") != "Results":
            return None

        channel = payload.get("channel", {})
        alternatives = channel.get("alternatives", []) if isinstance(channel, dict) else []
        if not alternatives:
            return None

        transcript = str(alternatives[0].get("transcript", "")).strip()
        if not transcript:
            return None

        observed_ts_ms = 0.0 if ts_ms is None else ts_ms
        metadata = {"provider": "deepgram", "model": self._model}

        if bool(payload.get("is_final")):
            self._tracker.mark("stt_final", observed_ts_ms, metadata)
            return {
                "type": "transcript.final",
                "text": self._committer.push_final(transcript),
            }

        stable_text = self._committer.push_partial(transcript)
        if stable_text is None:
            return None

        self._tracker.mark("stt_partial_stable", observed_ts_ms, metadata)
        return {
            "type": "transcript.partial_stable",
            "text": stable_text,
        }


def _build_listen_url(config: DeepgramConfig) -> str:
    query = urlencode(
        {
            "model": config.model,
            "language": config.language,
            "interim_results": str(config.interim_results).lower(),
            "endpointing": config.endpointing_ms,
            "punctuate": str(config.punctuate).lower(),
            "smart_format": str(config.smart_format).lower(),
        }
    )
    return f"{_DEEPGRAM_LISTEN_URL}?{query}"


def _json_summary(payload: dict[str, object]) -> str:
    return json.dumps(payload, default=str, sort_keys=True)


def _summarize_payload(payload: dict[str, object]) -> dict[str, object]:
    summary: dict[str, object] = {
        "payload_type": str(payload.get("type") or "unknown"),
    }

    if summary["payload_type"] == "Results":
        channel = payload.get("channel", {})
        alternatives = channel.get("alternatives", []) if isinstance(channel, dict) else []
        transcript = ""
        confidence: float | None = None
        if alternatives:
            transcript = str(alternatives[0].get("transcript", "")).strip()
            raw_confidence = alternatives[0].get("confidence")
            if isinstance(raw_confidence, (float, int)):
                confidence = round(float(raw_confidence), 4)
        summary.update(
            {
                "confidence": confidence,
                "is_final": bool(payload.get("is_final")),
                "transcript_length": len(transcript),
                "transcript_preview": transcript[:120],
            }
        )

    return summary


def _format_connection_closed(error: ConnectionClosed) -> str:
    return f"deepgram connection closed: code={error.code} reason={error.reason or 'unknown'}"


def _summarize_transcript_events(events: list[TranscriptEvent]) -> dict[str, object]:
    return {
        "event_count": len(events),
        "event_types": [event.get("type", "unknown") for event in events],
        "texts": [str(event.get("text") or "")[:120] for event in events],
    }
