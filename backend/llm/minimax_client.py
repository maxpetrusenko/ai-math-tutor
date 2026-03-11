from __future__ import annotations

from backend.llm.response_policy import shape_tutor_response
from backend.monitoring.latency_tracker import LatencyTracker


class MiniMaxClient:
    provider_name = "minimax"

    def stream_response(
        self,
        messages: list[dict[str, str]],
        token_stream: list[str],
        tracker: LatencyTracker,
        first_token_ts_ms: float,
        options: dict[str, str] | None = None,
    ) -> dict[str, str]:
        if token_stream:
            tracker.mark(
                "llm_first_token",
                first_token_ts_ms,
                {"provider": self.provider_name, "model": (options or {}).get("model", "minimax-m2.5")},
            )
        raw_text = "".join(token_stream)
        return {
            "provider": self.provider_name,
            "model": (options or {}).get("model", "minimax-m2.5"),
            "text": shape_tutor_response(raw_text),
            "input_messages": str(len(messages)),
        }
