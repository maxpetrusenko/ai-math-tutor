from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.monitoring.latency_tracker import LatencyTracker
    from backend.stt.provider import StreamingSTTSession


class BaseSTTProvider(ABC):
    """Speech-to-text provider interface."""

    provider_name: str

    @abstractmethod
    async def open_session(self, tracker: "LatencyTracker") -> "StreamingSTTSession":
        """Create a streaming STT session bound to the latency tracker."""
        ...


class BaseLLMProvider(ABC):
    """LLM provider interface."""

    provider_name: str

    @abstractmethod
    def stream_response(
        self,
        messages: list[dict[str, str]],
        token_stream: list[str],
        tracker: "LatencyTracker",
        first_token_ts_ms: float,
        options: dict[str, str] | None = None,
    ) -> dict[str, str]:
        """Stream LLM response, return result with text."""
        ...


class BaseTTSProvider(ABC):
    """Text-to-speech provider interface."""

    provider_name: str

    @abstractmethod
    def start_context(self, turn_id: str, voice_config: dict[str, str] | None = None) -> dict[str, object]:
        """Start a TTS context for a turn."""
        ...

    @abstractmethod
    def send_phrase(
        self,
        text: str,
        tracker: "LatencyTracker",
        first_audio_ts_ms: float,
        is_final: bool = False,
        options: dict[str, str] | None = None,
    ) -> dict[str, object]:
        """Convert text phrase to audio events."""
        ...

    @abstractmethod
    def flush(self) -> dict[str, object]:
        """Flush any buffered audio."""
        ...

    @abstractmethod
    def cancel(self) -> dict[str, object]:
        """Cancel any buffered or in-flight audio."""
        ...


class BaseAvatarProvider(ABC):
    """Avatar provider interface for frontend rendering."""

    provider_name: str

    @abstractmethod
    def get_initial_config(self) -> dict[str, object]:
        """Get initial avatar configuration (model URL, scale, etc)."""
        ...
