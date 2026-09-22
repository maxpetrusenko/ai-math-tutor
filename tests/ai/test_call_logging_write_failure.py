import json
import logging
from pathlib import Path

import pytest

from backend.ai import call_logging
from backend.ai.call_logging import run_logged_ai_call, run_logged_ai_call_async


@pytest.fixture(autouse=True)
def _reset_write_failure_warning(monkeypatch) -> None:
    # The warn-once latch is process global; reset it so each test observes
    # a clean first failure.
    monkeypatch.setattr(call_logging, "_write_failure_warned", False, raising=False)


def _blocked_log_path(tmp_path: Path) -> str:
    """Log path whose parent is an existing file, so every write raises OSError."""
    blocker = tmp_path / "blocker"
    blocker.write_text("not a directory")
    return str(blocker / "ai-calls.jsonl")


def _write_failure_warnings(caplog) -> list:
    return [
        record
        for record in caplog.records
        if record.name == "backend.ai.call_logging" and record.levelno >= logging.WARNING
    ]


def test_successful_call_survives_unwritable_ai_log_path(tmp_path, monkeypatch, caplog) -> None:
    monkeypatch.setenv("NERDY_AI_LOG_PATH", _blocked_log_path(tmp_path))
    caplog.set_level(logging.WARNING, logger="backend.ai.call_logging")

    result = run_logged_ai_call(
        logger=logging.getLogger("tests.ai.logwrite.sync"),
        provider="gemini",
        operation="llm.stream_response",
        request_payload={"messages": [{"role": "user", "content": "Help me solve for x."}]},
        call=lambda: {"text": "What number is attached to x?"},
    )

    assert result == {"text": "What number is attached to x?"}
    warnings = _write_failure_warnings(caplog)
    assert len(warnings) == 1
    assert "ai call log write failed" in warnings[0].getMessage()


@pytest.mark.asyncio
async def test_async_successful_call_survives_unwritable_ai_log_path(tmp_path, monkeypatch, caplog) -> None:
    monkeypatch.setenv("NERDY_AI_LOG_PATH", _blocked_log_path(tmp_path))
    caplog.set_level(logging.WARNING, logger="backend.ai.call_logging")

    async def _call() -> dict:
        return {"text": "ok"}

    result = await run_logged_ai_call_async(
        logger=logging.getLogger("tests.ai.logwrite.async"),
        provider="deepgram",
        operation="stt.finalize",
        request_payload={"chunk_bytes": 16},
        call=_call,
    )

    assert result == {"text": "ok"}
    warnings = _write_failure_warnings(caplog)
    assert len(warnings) == 1
    assert "ai call log write failed" in warnings[0].getMessage()


def test_provider_error_survives_unwritable_ai_log_path(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("NERDY_AI_LOG_PATH", _blocked_log_path(tmp_path))

    def _boom() -> None:
        raise RuntimeError("provider offline")

    with pytest.raises(RuntimeError, match="provider offline"):
        run_logged_ai_call(
            logger=logging.getLogger("tests.ai.logwrite.err"),
            provider="gemini",
            operation="llm.stream_response",
            request_payload={"messages": []},
            call=_boom,
        )


def test_repeated_write_failures_warn_once(tmp_path, monkeypatch, caplog) -> None:
    monkeypatch.setenv("NERDY_AI_LOG_PATH", _blocked_log_path(tmp_path))
    caplog.set_level(logging.WARNING, logger="backend.ai.call_logging")

    for index in range(3):
        run_logged_ai_call(
            logger=logging.getLogger("tests.ai.logwrite.repeat"),
            provider="gemini",
            operation="llm.stream_response",
            request_payload={"turn": index},
            call=lambda index=index: {"text": f"turn-{index}"},
        )

    warnings = _write_failure_warnings(caplog)
    assert len(warnings) == 1
    assert "ai call log write failed" in warnings[0].getMessage()


def test_writable_ai_log_path_still_records_calls(tmp_path, monkeypatch, caplog) -> None:
    log_path = tmp_path / "ai-calls.jsonl"
    monkeypatch.setenv("NERDY_AI_LOG_PATH", str(log_path))
    caplog.set_level(logging.WARNING, logger="backend.ai.call_logging")

    result = run_logged_ai_call(
        logger=logging.getLogger("tests.ai.logwrite.happy"),
        provider="gemini",
        operation="llm.stream_response",
        request_payload={"messages": [{"role": "user", "content": "help"}]},
        call=lambda: {"text": "ok"},
    )

    assert result == {"text": "ok"}
    records = [json.loads(line) for line in log_path.read_text().splitlines()]
    assert len(records) == 1
    assert records[0]["provider"] == "gemini"
    assert records[0]["status"] == "success"
    assert _write_failure_warnings(caplog) == []
