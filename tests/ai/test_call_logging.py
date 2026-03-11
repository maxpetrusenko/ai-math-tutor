import json
import logging

import pytest

from backend.ai.call_logging import run_logged_ai_call, run_logged_ai_call_async


def test_run_logged_ai_call_writes_jsonl_and_redacts_sensitive_fields(tmp_path, caplog, monkeypatch) -> None:
    monkeypatch.setenv("NERDY_AI_LOG_PATH", str(tmp_path / "ai-calls.jsonl"))
    perf_values = iter([10.0, 10.125])
    monkeypatch.setattr("backend.ai.call_logging.time.perf_counter", lambda: next(perf_values))
    caplog.set_level(logging.INFO)

    result = run_logged_ai_call(
        logger=logging.getLogger("tests.ai.sync"),
        provider="gemini",
        operation="llm.stream_response",
        request_payload={
            "headers": {"Authorization": "Bearer secret-token"},
            "messages": [{"role": "user", "content": "Help me solve for x."}],
        },
        call=lambda: {
            "provider": "gemini",
            "text": "Nice start. What number is attached to x?",
            "api_key": "should-not-leak",
        },
    )

    assert result["provider"] == "gemini"
    assert "ai call success" in caplog.text

    records = [json.loads(line) for line in (tmp_path / "ai-calls.jsonl").read_text().splitlines()]
    assert len(records) == 1
    assert records[0]["status"] == "success"
    assert records[0]["duration_ms"] == 125.0
    assert records[0]["request"]["headers"]["Authorization"] == "[redacted]"
    assert records[0]["response"]["api_key"] == "[redacted]"


def test_run_logged_ai_call_wraps_llm_calls_in_langsmith_trace(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _FakeTraceRun:
        def end(self, *, outputs=None, error=None) -> None:
            captured["outputs"] = outputs
            captured["error"] = error

    class _FakeTraceContext:
        def __enter__(self):
            captured["entered"] = True
            return _FakeTraceRun()

        def __exit__(self, exc_type, exc, tb) -> None:
            captured["exited"] = True
            return None

    def _fake_trace_langsmith_run(**kwargs):
        captured["trace_kwargs"] = kwargs
        return _FakeTraceContext()

    monkeypatch.setattr("backend.ai.call_logging.trace_langsmith_run", _fake_trace_langsmith_run)

    run_logged_ai_call(
        logger=logging.getLogger("tests.ai.trace"),
        provider="openai",
        operation="llm.stream_response",
        request_payload={"messages": [{"role": "user", "content": "help"}]},
        call=lambda: {"text": "Question back?"},
        langsmith_project="nerdy-runtime-llm",
        langsmith_run_type="llm",
    )

    assert captured["trace_kwargs"]["project_name"] == "nerdy-runtime-llm"
    assert captured["trace_kwargs"]["run_type"] == "llm"
    assert captured["entered"] is True
    assert captured["exited"] is True
    assert captured["outputs"]["status"] == "success"


@pytest.mark.asyncio
async def test_run_logged_ai_call_async_records_failures(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("NERDY_AI_LOG_PATH", str(tmp_path / "ai-calls.jsonl"))
    perf_values = iter([30.0, 30.2])
    monkeypatch.setattr("backend.ai.call_logging.time.perf_counter", lambda: next(perf_values))

    async def _boom() -> None:
        raise RuntimeError("provider offline")

    with pytest.raises(RuntimeError, match="provider offline"):
        await run_logged_ai_call_async(
            logger=logging.getLogger("tests.ai.async"),
            provider="deepgram",
            operation="stt.finalize",
            request_payload={"chunk_bytes": 128},
            call=_boom,
        )

    records = [json.loads(line) for line in (tmp_path / "ai-calls.jsonl").read_text().splitlines()]
    assert len(records) == 1
    assert records[0]["status"] == "error"
    assert records[0]["error"] == "provider offline"
    assert records[0]["duration_ms"] == 200.0
