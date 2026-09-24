import json
import logging
from pathlib import Path

import pytest

from backend.ai import call_logging
from backend.ai.call_logging import run_logged_ai_call


def _append_call(index: int) -> None:
    run_logged_ai_call(
        logger=logging.getLogger("tests.ai.rotation"),
        provider="deepgram",
        operation="stt.push_audio",
        request_payload={"chunk_bytes": 320, "chunk_index": index},
        call=lambda: [],
        response_summarizer=lambda events: {"event_count": 0},
    )


def _record_indices(path: Path) -> list[int]:
    return [int(json.loads(line)["request"]["chunk_index"]) for line in path.read_text().splitlines()]


def test_ai_log_rotates_to_single_backup_when_size_cap_reached(monkeypatch, tmp_path) -> None:
    log_path = tmp_path / "ai-calls.jsonl"
    monkeypatch.setenv("NERDY_AI_LOG_PATH", str(log_path))

    _append_call(1)
    record_bytes = log_path.stat().st_size
    monkeypatch.setenv("NERDY_AI_LOG_MAX_BYTES", str(record_bytes))

    _append_call(2)

    rotated_path = tmp_path / "ai-calls.jsonl.1"
    assert rotated_path.exists()
    assert _record_indices(rotated_path) == [1]
    assert rotated_path.stat().st_size >= record_bytes

    assert _record_indices(log_path) == [2]
    assert log_path.stat().st_size < record_bytes * 2


def test_ai_log_rotation_keeps_only_one_backup_generation(monkeypatch, tmp_path) -> None:
    log_path = tmp_path / "ai-calls.jsonl"
    monkeypatch.setenv("NERDY_AI_LOG_PATH", str(log_path))

    _append_call(1)
    record_bytes = log_path.stat().st_size
    monkeypatch.setenv("NERDY_AI_LOG_MAX_BYTES", str(record_bytes))

    for index in range(2, 7):
        _append_call(index)

    backups = sorted(tmp_path.glob("ai-calls.jsonl.*"))
    assert [path.name for path in backups] == ["ai-calls.jsonl.1"]

    current_records = _record_indices(log_path)
    assert current_records[-1] == 6
    rotated_records = _record_indices(backups[0])
    # The single backup must keep being replaced as newer generations rotate in:
    # with 6 appends it can only end at record 4 or 5. A stale first-generation
    # backup would leave record 1 here even though later rotations happened.
    assert 4 <= rotated_records[-1] < 6
    assert log_path.stat().st_size < record_bytes * 2


def test_ai_log_rotation_skips_append_when_below_cap(monkeypatch, tmp_path) -> None:
    log_path = tmp_path / "ai-calls.jsonl"
    monkeypatch.setenv("NERDY_AI_LOG_PATH", str(log_path))

    _append_call(1)
    record_bytes = log_path.stat().st_size
    monkeypatch.setenv("NERDY_AI_LOG_MAX_BYTES", str(record_bytes * 100))

    for index in range(2, 5):
        _append_call(index)

    assert not (tmp_path / "ai-calls.jsonl.1").exists()
    assert len(log_path.read_text().splitlines()) == 4


def test_rotation_failure_never_blocks_append(monkeypatch, tmp_path) -> None:
    log_path = tmp_path / "ai-calls.jsonl"
    monkeypatch.setenv("NERDY_AI_LOG_PATH", str(log_path))

    _append_call(1)
    record_bytes = log_path.stat().st_size
    monkeypatch.setenv("NERDY_AI_LOG_MAX_BYTES", str(record_bytes))

    def failing_replace(self, target):  # noqa: ANN001, ANN002
        raise OSError("rename blocked")

    monkeypatch.setattr(Path, "replace", failing_replace)

    _append_call(2)

    assert _record_indices(log_path) == [1, 2]
    assert not (tmp_path / "ai-calls.jsonl.1").exists()


@pytest.mark.parametrize("cap", ["0", "-5"])
def test_ai_log_rotation_disabled_when_cap_not_positive(monkeypatch, tmp_path, cap) -> None:
    log_path = tmp_path / "ai-calls.jsonl"
    monkeypatch.setenv("NERDY_AI_LOG_PATH", str(log_path))
    monkeypatch.setenv("NERDY_AI_LOG_MAX_BYTES", cap)

    for index in range(1, 6):
        _append_call(index)

    assert not (tmp_path / "ai-calls.jsonl.1").exists()
    assert [int(record["request"]["chunk_index"]) for record in map(json.loads, log_path.read_text().splitlines())] == [
        1,
        2,
        3,
        4,
        5,
    ]


def test_ai_log_rotation_skips_when_path_is_not_a_file(monkeypatch, tmp_path) -> None:
    log_dir = tmp_path / "ai-calls.jsonl"
    log_dir.mkdir()
    monkeypatch.setenv("NERDY_AI_LOG_PATH", str(log_dir))
    monkeypatch.setenv("NERDY_AI_LOG_MAX_BYTES", "1")

    with pytest.raises(IsADirectoryError):
        _append_call(1)

    assert log_dir.is_dir()
    assert not (tmp_path / "ai-calls.jsonl.1").exists()


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, call_logging._DEFAULT_AI_LOG_MAX_BYTES),
        ("", call_logging._DEFAULT_AI_LOG_MAX_BYTES),
        ("abc", call_logging._DEFAULT_AI_LOG_MAX_BYTES),
        ("12345", 12345),
        ("0", 0),
        ("-5", -5),
    ],
)
def test_resolve_ai_log_max_bytes(monkeypatch, raw, expected) -> None:
    if raw is None:
        monkeypatch.delenv("NERDY_AI_LOG_MAX_BYTES", raising=False)
    else:
        monkeypatch.setenv("NERDY_AI_LOG_MAX_BYTES", raw)

    assert call_logging._resolve_ai_log_max_bytes() == expected


def test_env_docs_document_ai_log_size_cap() -> None:
    default = call_logging._DEFAULT_AI_LOG_MAX_BYTES
    env_example_lines = [line.strip() for line in Path(".env.example").read_text().splitlines()]
    readme_lines = [line.strip() for line in Path("README.md").read_text().splitlines()]

    assert f"NERDY_AI_LOG_MAX_BYTES={default}" in env_example_lines
    assert f"NERDY_AI_LOG_MAX_BYTES={default}" in readme_lines
