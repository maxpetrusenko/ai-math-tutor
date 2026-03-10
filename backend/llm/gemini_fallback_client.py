from __future__ import annotations

from backend.llm.response_policy import shape_tutor_response
from backend.monitoring.latency_tracker import LatencyTracker


class GeminiFallbackClient:
    provider_name = "gemini"

    def stream_response(
        self,
        messages: list[dict[str, str]],
        token_stream: list[str],
        tracker: LatencyTracker,
        first_token_ts_ms: float,
    ) -> dict[str, str]:
        if token_stream:
            tracker.mark("llm_first_token", first_token_ts_ms, {"provider": self.provider_name})
        return {
            "provider": self.provider_name,
            "text": shape_tutor_response("".join(token_stream)),
            "input_messages": str(len(messages)),
        }
