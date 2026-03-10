from __future__ import annotations

import os

from backend.monitoring.latency_tracker import LatencyTracker
from backend.providers import create_provider


class ProviderSwitch:
    def __init__(self, primary=None, fallback=None) -> None:
        self.primary = primary or create_provider("llm")
        self.fallback = fallback or create_provider("llm", os.getenv("NERDY_LLM_FALLBACK_PROVIDER", "gemini"))

    def stream_response(
        self,
        messages: list[dict[str, str]],
        token_stream: list[str],
        tracker: LatencyTracker,
        first_token_ts_ms: float,
        use_fallback: bool = False,
    ) -> dict[str, str]:
        provider = self.fallback if use_fallback else self.primary
        return provider.stream_response(
            messages=messages,
            token_stream=token_stream,
            tracker=tracker,
            first_token_ts_ms=first_token_ts_ms,
        )
