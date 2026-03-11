from __future__ import annotations

import logging
import os
import time
from abc import ABC, abstractmethod

from backend.ai.call_logging import run_logged_ai_call
from backend.benchmarks.run_latency_benchmark import load_local_env
from backend.llm.langchain_bridge import (
    build_langchain_prompt_value,
    summarize_langchain_llm_input,
    summarize_langchain_llm_output,
)
from backend.llm.response_policy import shape_tutor_response
from backend.monitoring.latency_tracker import LatencyTracker

DEFAULT_LANGCHAIN_LIVE_TIMEOUT_SECONDS = 4.0


class BaseLangChainChatClient(ABC):
    provider_name: str
    default_model: str
    api_key_env_names: tuple[str, ...]

    def __init__(self, *, logger: logging.Logger) -> None:
        self._logger = logger

    def stream_response(
        self,
        messages: list[dict[str, str]],
        token_stream: list[str],
        tracker: LatencyTracker,
        first_token_ts_ms: float,
        options: dict[str, str] | None = None,
    ) -> dict[str, str]:
        model = str((options or {}).get("model") or self.default_model).strip() or self.default_model
        request_payload = summarize_langchain_llm_input(messages, model=model)
        api_key = self._resolve_api_key()
        if api_key:
            try:
                return run_logged_ai_call(
                    logger=self._logger,
                    provider=self.provider_name,
                    operation="llm.stream_response",
                    request_payload={**request_payload, "mode": "live"},
                    call=lambda: self._stream_live_response(
                        messages=messages,
                        model=model,
                        tracker=tracker,
                        speech_end_ts_ms=first_token_ts_ms,
                        api_key=api_key,
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
            logger=self._logger,
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
        prompt_value = build_langchain_prompt_value(messages)
        llm = self._build_chat_model(model=model, api_key=api_key)

        text_parts: list[str] = []
        first_token_delta_ms: float | None = None
        for chunk in llm.stream(prompt_value.messages):
            text = extract_langchain_chunk_text(chunk)
            if not text:
                continue
            if first_token_delta_ms is None:
                first_token_delta_ms = round((time.perf_counter() - started_at) * 1000, 1)
            text_parts.append(text)

        if first_token_delta_ms is None:
            raise RuntimeError(f"{self.provider_name} did not emit a text chunk")

        tracker.mark(
            "llm_first_token",
            round(speech_end_ts_ms + first_token_delta_ms, 1),
            {
                "provider": self.provider_name,
                "mode": "live",
                "model": model,
            },
        )
        return {
            "provider": self.provider_name,
            "text": shape_tutor_response("".join(text_parts)),
            "input_messages": str(len(messages)),
            "model": model,
        }

    @abstractmethod
    def _build_chat_model(self, *, model: str, api_key: str) -> object:
        raise NotImplementedError

    def _resolve_api_key(self) -> str:
        if os.getenv("NERDY_DISABLE_LIVE_LLM", "").strip() == "1":
            return ""
        load_local_env()
        for env_name in self.api_key_env_names:
            value = (os.getenv(env_name) or "").strip()
            if value:
                return value
        return ""

    def _request_timeout_seconds(self) -> float:
        raw_value = os.getenv("NERDY_LIVE_LLM_TIMEOUT_SECONDS", "").strip()
        if not raw_value:
            return DEFAULT_LANGCHAIN_LIVE_TIMEOUT_SECONDS
        try:
            return max(0.1, float(raw_value))
        except ValueError:
            return DEFAULT_LANGCHAIN_LIVE_TIMEOUT_SECONDS


def extract_langchain_chunk_text(chunk: object) -> str:
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
