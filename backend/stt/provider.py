from __future__ import annotations
from typing import Protocol

from backend.monitoring.latency_tracker import LatencyTracker
from backend.providers import create_provider

TranscriptEvent = dict[str, str]


class StreamingSTTSession(Protocol):
    async def push_audio(self, chunk: bytes, *, ts_ms: float | None = None) -> list[TranscriptEvent]:
        """Stream audio bytes and return any transcript events currently ready."""

    async def finalize(self, *, ts_ms: float) -> list[TranscriptEvent]:
        """Finalize the utterance and return transcript events, including final text when available."""

    async def close(self) -> None:
        """Release provider resources for this session."""


class StreamingSTTProvider(Protocol):
    async def open_session(self, tracker: LatencyTracker) -> StreamingSTTSession:
        """Create a new streaming STT session bound to the latency tracker."""


class STTProviderFactory:
    def create(self, provider_name: str | None = None) -> StreamingSTTProvider:
        return create_provider("stt", provider_name)
