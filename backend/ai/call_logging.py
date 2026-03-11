from __future__ import annotations

import json
import logging
import os
import re
import time
from contextlib import nullcontext
from pathlib import Path
from typing import Any, Awaitable, Callable, TypeVar

from backend.ai.langsmith import trace_langsmith_run

T = TypeVar("T")

_DEFAULT_AI_LOG_PATH = ".nerdy-data/ai-calls.jsonl"
_MAX_TEXT_LENGTH = 280
_REDACTED = "[redacted]"
_SENSITIVE_KEY_MARKERS = ("api_key", "authorization", "token", "secret", "password")
_URL_SECRET_PATTERN = re.compile(r"([?&](?:key|token|api_key)=)[^&]+", re.IGNORECASE)


def run_logged_ai_call(
    *,
    logger: logging.Logger,
    provider: str,
    operation: str,
    request_payload: Any,
    call: Callable[[], T],
    response_summarizer: Callable[[T], Any] | None = None,
    langsmith_project: str | None = None,
    langsmith_run_name: str | None = None,
    langsmith_run_type: str | None = None,
) -> T:
    logger.info("ai call start %s", _json_summary({"provider": provider, "operation": operation}))
    started_at = time.perf_counter()
    with _langsmith_trace_context(
        provider=provider,
        operation=operation,
        request_payload=request_payload,
        langsmith_project=langsmith_project,
        langsmith_run_name=langsmith_run_name,
        langsmith_run_type=langsmith_run_type,
    ) as trace_run:
        try:
            result = call()
        except Exception as error:
            duration_ms = _duration_ms(started_at)
            _end_langsmith_trace(trace_run, outputs={"status": "error", "duration_ms": duration_ms}, error=str(error))
            _record_and_log(
                logger=logger,
                provider=provider,
                operation=operation,
                request_payload=request_payload,
                status="error",
                duration_ms=duration_ms,
                error=str(error),
            )
            raise

        response_payload = response_summarizer(result) if response_summarizer else result
        duration_ms = _duration_ms(started_at)
        _end_langsmith_trace(
            trace_run,
            outputs={
                "status": "success",
                "duration_ms": duration_ms,
                "response": _sanitize(response_payload),
            },
        )
        _record_and_log(
            logger=logger,
            provider=provider,
            operation=operation,
            request_payload=request_payload,
            response_payload=response_payload,
            status="success",
            duration_ms=duration_ms,
        )
        return result


async def run_logged_ai_call_async(
    *,
    logger: logging.Logger,
    provider: str,
    operation: str,
    request_payload: Any,
    call: Callable[[], Awaitable[T]],
    response_summarizer: Callable[[T], Any] | None = None,
    langsmith_project: str | None = None,
    langsmith_run_name: str | None = None,
    langsmith_run_type: str | None = None,
) -> T:
    logger.info("ai call start %s", _json_summary({"provider": provider, "operation": operation}))
    started_at = time.perf_counter()
    with _langsmith_trace_context(
        provider=provider,
        operation=operation,
        request_payload=request_payload,
        langsmith_project=langsmith_project,
        langsmith_run_name=langsmith_run_name,
        langsmith_run_type=langsmith_run_type,
    ) as trace_run:
        try:
            result = await call()
        except Exception as error:
            duration_ms = _duration_ms(started_at)
            _end_langsmith_trace(trace_run, outputs={"status": "error", "duration_ms": duration_ms}, error=str(error))
            _record_and_log(
                logger=logger,
                provider=provider,
                operation=operation,
                request_payload=request_payload,
                status="error",
                duration_ms=duration_ms,
                error=str(error),
            )
            raise

        response_payload = response_summarizer(result) if response_summarizer else result
        duration_ms = _duration_ms(started_at)
        _end_langsmith_trace(
            trace_run,
            outputs={
                "status": "success",
                "duration_ms": duration_ms,
                "response": _sanitize(response_payload),
            },
        )
        _record_and_log(
            logger=logger,
            provider=provider,
            operation=operation,
            request_payload=request_payload,
            response_payload=response_payload,
            status="success",
            duration_ms=duration_ms,
        )
        return result


def _record_and_log(
    *,
    logger: logging.Logger,
    provider: str,
    operation: str,
    request_payload: Any,
    status: str,
    duration_ms: float,
    response_payload: Any | None = None,
    error: str | None = None,
) -> None:
    record = {
        "provider": provider,
        "operation": operation,
        "status": status,
        "duration_ms": duration_ms,
        "request": _sanitize(request_payload),
    }
    if response_payload is not None:
        record["response"] = _sanitize(response_payload)
    if error is not None:
        record["error"] = error

    _append_jsonl_record(record)
    log_method = logger.info if status == "success" else logger.error
    log_method("ai call %s %s", status, _json_summary(record))


def _append_jsonl_record(record: dict[str, Any]) -> None:
    path = Path(os.getenv("NERDY_AI_LOG_PATH", _DEFAULT_AI_LOG_PATH))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(f"{json.dumps(record, sort_keys=True, default=str)}\n")


def _sanitize(value: Any, *, key: str | None = None) -> Any:
    key_lower = (key or "").lower()
    if any(marker in key_lower for marker in _SENSITIVE_KEY_MARKERS):
        return _REDACTED

    if isinstance(value, dict):
        return {str(item_key): _sanitize(item_value, key=str(item_key)) for item_key, item_value in value.items()}
    if isinstance(value, list):
        return [_sanitize(item) for item in value]
    if isinstance(value, tuple):
        return [_sanitize(item) for item in value]
    if isinstance(value, (bytes, bytearray)):
        return {"type": "bytes", "size": len(value)}
    if isinstance(value, str):
        redacted = _URL_SECRET_PATTERN.sub(r"\1[redacted]", value)
        if len(redacted) <= _MAX_TEXT_LENGTH:
            return redacted
        return f"{redacted[:_MAX_TEXT_LENGTH]}..."
    return value


def _duration_ms(started_at: float) -> float:
    return round((time.perf_counter() - started_at) * 1000, 1)


def _json_summary(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, default=str)


def _langsmith_trace_context(
    *,
    provider: str,
    operation: str,
    request_payload: Any,
    langsmith_project: str | None,
    langsmith_run_name: str | None,
    langsmith_run_type: str | None,
):
    if not langsmith_project or not langsmith_run_type:
        return nullcontext(None)
    return trace_langsmith_run(
        project_name=langsmith_project,
        run_name=langsmith_run_name or f"{provider}.{operation}",
        run_type=langsmith_run_type,
        inputs={
            "provider": provider,
            "operation": operation,
            "request": _sanitize(request_payload),
        },
        metadata={"provider": provider, "operation": operation},
    )


def _end_langsmith_trace(trace_run: Any, *, outputs: dict[str, Any], error: str | None = None) -> None:
    if trace_run is None:
        return
    trace_run.end(outputs=outputs, error=error)
