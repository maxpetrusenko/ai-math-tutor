import asyncio
import logging

from backend.monitoring.latency_tracker import LatencyTracker
from backend.stt.deepgram_client import DeepgramStreamingClient


class _FakeConnection:
    def __init__(
        self,
        audio_batches: list[list[dict[str, object]]] | None = None,
        control_batches: list[list[dict[str, object]]] | None = None,
    ) -> None:
        self.audio_batches = list(audio_batches or [])
        self.control_batches = list(control_batches or [])
        self.queue: asyncio.Queue[dict[str, object]] = asyncio.Queue()
        self.audio_payloads: list[bytes] = []
        self.control_payloads: list[dict[str, object]] = []
        self.closed = False

    async def send_bytes(self, chunk: bytes) -> None:
        self.audio_payloads.append(chunk)
        for message in self.audio_batches.pop(0) if self.audio_batches else []:
            await self.queue.put(message)

    async def send_json(self, payload: dict[str, object]) -> None:
        self.control_payloads.append(payload)
        for message in self.control_batches.pop(0) if self.control_batches else []:
            await self.queue.put(message)

    async def recv_json(self) -> dict[str, object]:
        return await self.queue.get()

    async def close(self) -> None:
        self.closed = True


class _FakeTransport:
    def __init__(self, connection: _FakeConnection) -> None:
        self.connection = connection
        self.calls: list[tuple[str, str]] = []

    async def connect(self, api_key: str, url: str) -> _FakeConnection:
        self.calls.append((api_key, url))
        return self.connection


class _DelayedControlConnection(_FakeConnection):
    def __init__(self, *, delay_s: float, payload: dict[str, object]) -> None:
        super().__init__()
        self.delay_s = delay_s
        self.payload = payload
        self._payload_sent = False

    async def recv_json(self) -> dict[str, object]:
        if not self._payload_sent:
            await asyncio.sleep(self.delay_s)
            self._payload_sent = True
            return self.payload
        await asyncio.sleep(60)
        raise RuntimeError("unexpected extra recv_json call")


def test_deepgram_client_emits_stable_partial_and_marks_latency() -> None:
    async def run() -> tuple[list[dict[str, str]], list[object], list[bytes]]:
        tracker = LatencyTracker()
        connection = _FakeConnection(
            audio_batches=[
                [
                    {
                        "type": "Results",
                        "is_final": False,
                        "channel": {"alternatives": [{"transcript": "solve for x"}]},
                    }
                ],
                [
                    {
                        "type": "Results",
                        "is_final": False,
                        "channel": {"alternatives": [{"transcript": "solve for x"}]},
                    }
                ],
            ]
        )
        client = DeepgramStreamingClient(api_key="test-key", stability_repeats=2, transport=_FakeTransport(connection))
        session = await client.open_session(tracker)

        first = await session.push_audio(b"chunk-1", ts_ms=110)
        second = await session.push_audio(b"chunk-2", ts_ms=130)

        await session.close()
        return first + second, tracker.events, connection.audio_payloads

    events, tracker_events, audio_payloads = asyncio.run(run())

    assert events == [
        {
            "type": "transcript.partial_stable",
            "text": "solve for x",
        }
    ]
    assert tracker_events[0].name == "stt_partial_stable"
    assert audio_payloads == [b"chunk-1", b"chunk-2"]


def test_deepgram_client_emits_final_transcript_and_marks_latency() -> None:
    async def run() -> tuple[list[dict[str, str]], list[object], list[dict[str, object]], bool]:
        tracker = LatencyTracker()
        connection = _FakeConnection(
            control_batches=[
                [
                    {
                        "type": "Results",
                        "is_final": True,
                        "channel": {"alternatives": [{"transcript": "what about photosynthesis"}]},
                    }
                ]
            ]
        )
        client = DeepgramStreamingClient(api_key="test-key", stability_repeats=2, transport=_FakeTransport(connection))
        session = await client.open_session(tracker)

        events = await session.finalize(ts_ms=200)
        await session.close()
        return events, tracker.events, connection.control_payloads, connection.closed

    events, tracker_events, control_payloads, closed = asyncio.run(run())

    assert events == [
        {
            "type": "transcript.final",
            "text": "what about photosynthesis",
        }
    ]
    assert tracker_events[0].name == "stt_final"
    assert control_payloads == [{"type": "Finalize"}]
    assert closed is True


def test_deepgram_client_waits_for_delayed_final_transcript_after_finalize() -> None:
    async def run() -> list[dict[str, str]]:
        tracker = LatencyTracker()
        connection = _DelayedControlConnection(
            delay_s=0.75,
            payload={
                "type": "Results",
                "is_final": True,
                "channel": {"alternatives": [{"transcript": "heard after finalize delay"}]},
            },
        )
        client = DeepgramStreamingClient(api_key="test-key", transport=_FakeTransport(connection))
        session = await client.open_session(tracker)

        try:
            return await session.finalize(ts_ms=200)
        finally:
            await session.close()

    events = asyncio.run(run())

    assert events == [
        {
            "type": "transcript.final",
            "text": "heard after finalize delay",
        }
    ]


def test_deepgram_client_logs_connect_and_audio_payload_summary(caplog) -> None:
    async def run() -> None:
        tracker = LatencyTracker()
        connection = _FakeConnection(
            audio_batches=[[{"type": "Metadata", "request_id": "req-1"}]],
            control_batches=[
                [
                    {
                        "type": "Results",
                        "is_final": True,
                        "channel": {"alternatives": [{"transcript": "logged final", "confidence": 0.98}]},
                    }
                ]
            ],
        )
        client = DeepgramStreamingClient(api_key="test-key", transport=_FakeTransport(connection))
        session = await client.open_session(tracker)
        await session.push_audio(b"chunk-123", ts_ms=110)
        await session.finalize(ts_ms=220)
        await session.close()

    caplog.set_level(logging.INFO)
    asyncio.run(run())

    assert "deepgram session opening" in caplog.text
    assert '"chunk_bytes": 9' in caplog.text
    assert '"payload_type": "Metadata"' in caplog.text
    assert '"control_type": "Finalize"' in caplog.text
    assert '"confidence": 0.98' in caplog.text


def test_deepgram_client_loads_local_env_before_requiring_api_key(monkeypatch) -> None:
    async def run() -> list[tuple[str, str]]:
        tracker = LatencyTracker()
        connection = _FakeConnection()
        transport = _FakeTransport(connection)
        monkeypatch.delenv("DEEPGRAM_API_KEY", raising=False)

        def _load_env() -> list[str]:
            monkeypatch.setenv("DEEPGRAM_API_KEY", "loaded-from-env")
            return [".env"]

        monkeypatch.setattr("backend.stt.deepgram_client.load_local_env", _load_env)

        client = DeepgramStreamingClient(api_key=None, transport=transport)
        session = await client.open_session(tracker)
        await session.close()
        return transport.calls

    calls = asyncio.run(run())

    assert calls
    assert calls[0][0] == "loaded-from-env"
