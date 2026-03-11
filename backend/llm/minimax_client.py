from __future__ import annotations

import logging

from backend.ai.call_logging import run_logged_ai_call
from backend.llm.langchain_bridge import summarize_langchain_llm_input, summarize_langchain_llm_output
from backend.llm.response_policy import shape_tutor_response
from backend.monitoring.latency_tracker import LatencyTracker

logger = logging.getLogger(__name__)


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
        model = (options or {}).get("model", "minimax-m2.5")

        def _build_response() -> dict[str, str]:
            if token_stream:
                tracker.mark(
                    "llm_first_token",
                    first_token_ts_ms,
                    {"provider": self.provider_name, "model": model},
                )
            raw_text = "".join(token_stream)
            return {
                "provider": self.provider_name,
                "model": model,
                "text": shape_tutor_response(raw_text),
                "input_messages": str(len(messages)),
            }

        return run_logged_ai_call(
            logger=logger,
            provider=self.provider_name,
            operation="llm.stream_response",
            request_payload={**summarize_langchain_llm_input(messages, model=model), "mode": "stub"},
            call=_build_response,
            response_summarizer=summarize_langchain_llm_output,
            langsmith_project="nerdy-runtime-llm",
            langsmith_run_type="llm",
        )
