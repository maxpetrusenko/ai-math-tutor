from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlencode

from websockets.asyncio.client import connect as websocket_connect

from backend.monitoring.latency_tracker import LatencyTracker
from backend.stt.provider import StreamingSTTSession, TranscriptEvent
from backend.turn_taking.transcript_commit import TranscriptCommitter

_DEEPGRAM_LISTEN_URL = "wss://api.deepgram.com/v1/listen"


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
    model: str = "nova-2"
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
        model: str = "nova-2",
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
            raise RuntimeError("DEEPGRAM_API_KEY is required for audio streaming STT")

        url = _build_listen_url(self.config)
        connection = await self.transport.connect(api_key, url)
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

    async def push_audio(self, chunk: bytes, *, ts_ms: float | None = None) -> list[TranscriptEvent]:
        await self._connection.send_bytes(chunk)
        return await self._drain_events(ts_ms=ts_ms)

    async def finalize(self, *, ts_ms: float) -> list[TranscriptEvent]:
        await self._connection.send_json({"type": "Finalize"})
        return await self._drain_events(ts_ms=ts_ms, stop_on_final=True)

    async def close(self) -> None:
        await self._connection.close()

    async def _drain_events(
        self,
        *,
        ts_ms: float | None,
        stop_on_final: bool = False,
    ) -> list[TranscriptEvent]:
        events: list[TranscriptEvent] = []
        timeout = 0.5 if stop_on_final else 0.01

        while True:
            try:
                payload = await asyncio.wait_for(self._connection.recv_json(), timeout=timeout)
            except TimeoutError:
                break

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
