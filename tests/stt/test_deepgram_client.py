import asyncio

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
