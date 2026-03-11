from __future__ import annotations

import logging
import os
import time

from backend.benchmarks.run_latency_benchmark import load_local_env
from backend.ai.call_logging import run_logged_ai_call
from backend.llm.langchain_bridge import (
    build_langchain_prompt_value,
    summarize_langchain_llm_input,
    summarize_langchain_llm_output,
)
from backend.llm.response_policy import shape_tutor_response
from backend.monitoring.latency_tracker import LatencyTracker
from langchain_google_genai import ChatGoogleGenerativeAI

DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview"
DEFAULT_GEMINI_LIVE_TIMEOUT_SECONDS = 10.0
MIN_GEMINI_LIVE_TIMEOUT_SECONDS = 10.0
logger = logging.getLogger(__name__)


class GeminiFallbackClient:
    provider_name = "gemini"

    def stream_response(
        self,
        messages: list[dict[str, str]],
        token_stream: list[str],
        tracker: LatencyTracker,
        first_token_ts_ms: float,
        options: dict[str, str] | None = None,
    ) -> dict[str, str]:
        model = (options or {}).get("model", DEFAULT_GEMINI_MODEL)
        request_payload = summarize_langchain_llm_input(messages, model=model)
        live_api_key = self._resolve_api_key()
        if live_api_key:
            try:
                return run_logged_ai_call(
                    logger=logger,
                    provider=self.provider_name,
                    operation="llm.stream_response",
                    request_payload={**request_payload, "mode": "live"},
                    call=lambda: self._stream_live_response(
                        messages=messages,
                        model=model,
                        tracker=tracker,
                        speech_end_ts_ms=first_token_ts_ms,
                        api_key=live_api_key,
                    ),
                    response_summarizer=summarize_langchain_llm_output,
                    langsmith_project="nerdy-runtime-llm",
                    langsmith_run_type="llm",
                )
            except Exception:
                pass

        def _build_stub_response() -> dict[str, str]:
            if token_stream:
                tracker.mark(
                    "llm_first_token",
                    first_token_ts_ms,
                    {
                        "provider": self.provider_name,
                        "mode": "stub",
                        "model": model,
                    },
                )
            return {
                "provider": self.provider_name,
                "model": model,
                "text": shape_tutor_response("".join(token_stream)),
                "input_messages": str(len(messages)),
            }

        return run_logged_ai_call(
            logger=logger,
            provider=self.provider_name,
            operation="llm.stream_response",
            request_payload={**request_payload, "mode": "stub"},
            call=_build_stub_response,
            response_summarizer=summarize_langchain_llm_output,
            langsmith_project="nerdy-runtime-llm",
            langsmith_run_type="llm",
        )

    def _stream_live_response(
        self,
        *,
        messages: list[dict[str, str]],
        model: str,
        tracker: LatencyTracker,
        speech_end_ts_ms: float,
        api_key: str,
    ) -> dict[str, str]:
        started_at = time.perf_counter()
        model = model.strip() or DEFAULT_GEMINI_MODEL
        prompt_value = build_langchain_prompt_value(messages)
        llm = ChatGoogleGenerativeAI(
            model=model,
            api_key=api_key,
            temperature=0.4,
            max_tokens=256,
            request_timeout=_resolve_live_timeout_seconds(
                "NERDY_LIVE_LLM_TIMEOUT_SECONDS",
                DEFAULT_GEMINI_LIVE_TIMEOUT_SECONDS,
            ),
        )

        text_parts: list[str] = []
        first_token_delta_ms: float | None = None
        for chunk in llm.stream(prompt_value.messages):
            text = _extract_langchain_chunk_text(chunk)
            if not text:
                continue
            if first_token_delta_ms is None:
                first_token_delta_ms = round((time.perf_counter() - started_at) * 1000, 1)
            text_parts.append(text)

        if first_token_delta_ms is None:
            raise RuntimeError("Gemini did not emit a text chunk")

        tracker.mark(
            "llm_first_token",
            round(speech_end_ts_ms + first_token_delta_ms, 1),
            {"provider": self.provider_name, "mode": "live", "model": model},
        )
        text = shape_tutor_response("".join(text_parts))
        return {
            "provider": self.provider_name,
            "text": text,
            "input_messages": str(len(messages)),
            "model": model,
        }

    def _resolve_api_key(self) -> str:
        if os.getenv("NERDY_DISABLE_LIVE_LLM", "").strip() == "1":
            return ""
        load_local_env()
        return (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY") or "").strip()


def _extract_langchain_chunk_text(chunk: object) -> str:
    content = getattr(chunk, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        texts: list[str] = []
        for item in content:
            if isinstance(item, str):
                texts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    texts.append(text)
        return "".join(texts)
    return str(content or "")


def _resolve_live_timeout_seconds(env_name: str, default: float) -> float:
    raw_value = os.getenv(env_name, "").strip()
    if not raw_value:
        return default
    try:
        return max(MIN_GEMINI_LIVE_TIMEOUT_SECONDS, float(raw_value))
    except ValueError:
        return default
