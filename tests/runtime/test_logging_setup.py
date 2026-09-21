"""Guards for the application logging bootstrap (backend/runtime/logging_setup.py).

The session app is started in production exactly like this (backend/Dockerfile):

    uvicorn backend.session.server:app --host 0.0.0.0 --port 8080

uvicorn's default logging config only configures its own ``uvicorn*`` loggers
and never touches the root logger, so without an application-side bootstrap
every INFO-level app record (session lifecycle, AI call summaries, transcript
resolution) is silently dropped in production containers. WARNING+ records
leak to stderr through the stdlib ``lastResort`` handler, unformatted.

These tests lock in (a) the bootstrap behavior, (b) the non-vacuity of the
hazard it exists to prevent, (c) the server wiring that activates it, and
(d) the env-var documentation contract.
"""
from __future__ import annotations

import io
import logging
import os
import subprocess
import sys
from pathlib import Path

from backend.runtime.logging_setup import configure_logging, resolve_log_level

REPO_ROOT = Path(__file__).resolve().parents[2]


def _run_python(code: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=90,
        env={
            **os.environ,
            "NERDY_LOG_LEVEL": "INFO",
            "PYTHONPATH": str(REPO_ROOT),
        },
    )


def test_resolve_log_level_defaults_to_info(monkeypatch) -> None:
    monkeypatch.delenv("NERDY_LOG_LEVEL", raising=False)
    assert resolve_log_level() == logging.INFO


def test_resolve_log_level_reads_env_case_insensitively(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_LOG_LEVEL", "debug")
    assert resolve_log_level() == logging.DEBUG
    monkeypatch.setenv("NERDY_LOG_LEVEL", " Warning ")
    assert resolve_log_level() == logging.WARNING


def test_resolve_log_level_falls_back_on_invalid_value(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_LOG_LEVEL", "verbose")
    assert resolve_log_level() == logging.INFO


def test_configure_logging_installs_handler_and_level(monkeypatch) -> None:
    root = logging.getLogger()
    monkeypatch.setattr(root, "handlers", [])
    monkeypatch.setenv("NERDY_LOG_LEVEL", "debug")

    assert configure_logging() is True

    assert root.level == logging.DEBUG
    assert len(root.handlers) == 1
    handler = root.handlers[0]
    assert isinstance(handler, logging.StreamHandler)
    record = logging.LogRecord(
        "backend.session.server", logging.INFO, __file__, 1, "hello world", None, None
    )
    formatted = handler.format(record)
    assert "backend.session.server" in formatted
    assert "INFO" in formatted
    assert "hello world" in formatted


def test_configure_logging_writes_records_to_stream(monkeypatch) -> None:
    root = logging.getLogger()
    monkeypatch.setattr(root, "handlers", [])
    stream = io.StringIO()

    assert configure_logging(level=logging.INFO, stream=stream) is True
    logging.getLogger("backend.unit").info("probe line")

    assert "probe line" in stream.getvalue()


def test_configure_logging_installs_once(monkeypatch) -> None:
    root = logging.getLogger()
    monkeypatch.setattr(root, "handlers", [])
    monkeypatch.delenv("NERDY_LOG_LEVEL", raising=False)

    assert configure_logging() is True
    assert configure_logging() is False
    assert len(root.handlers) == 1


def test_configure_logging_leaves_an_owned_root_logger_alone(monkeypatch) -> None:
    root = logging.getLogger()
    sentinel = logging.NullHandler()
    monkeypatch.setattr(root, "handlers", [sentinel])
    monkeypatch.setattr(root, "level", logging.ERROR)
    monkeypatch.setenv("NERDY_LOG_LEVEL", "DEBUG")

    assert configure_logging() is False

    assert root.handlers == [sentinel]
    assert root.level == logging.ERROR


def test_session_app_logs_reach_stdout_when_bootstrapped() -> None:
    probe = (
        "import logging\n"
        "from backend.runtime.logging_setup import configure_logging\n"
        "configure_logging()\n"
        "logging.getLogger('backend.session.server').info('session probe visible')\n"
    )
    result = _run_python(probe)

    assert result.returncode == 0, result.stderr
    assert "session probe visible" in result.stdout
    assert "backend.session.server" in result.stdout


def test_app_info_logs_are_dropped_without_the_bootstrap() -> None:
    """Non-vacuity control: the hazard this module exists to prevent.

    A bare interpreter behaves like the production container whose root logger
    is left untouched by uvicorn's default config: INFO records disappear. If
    this ever stops being true, the bootstrap module can be retired.
    """
    probe = (
        "import logging\n"
        "logging.getLogger('backend.session.server').info('session probe dropped')\n"
    )
    result = _run_python(probe)

    assert result.returncode == 0, result.stderr
    assert "session probe dropped" not in f"{result.stdout}{result.stderr}"


def test_session_server_bootstraps_logging() -> None:
    source = (REPO_ROOT / "backend" / "session" / "server.py").read_text(encoding="utf-8")

    assert "from backend.runtime.logging_setup import configure_logging" in source
    assert "configure_logging()" in source


def test_session_server_import_bootstraps_logging_end_to_end() -> None:
    """Behavioral wiring guard: the production entrypoint chain is the
    Dockerfile CMD importing backend.session.server; in a bare interpreter that
    import must leave the root logger configured so app INFO reaches stdout.
    A source-text grep alone would still pass if the call were commented out.
    """
    probe = (
        "import logging\n"
        "import backend.session.server  # production entrypoint module\n"
        "logging.getLogger('backend.session.server').info('WIRED-INFO-PROBE')\n"
    )
    result = _run_python(probe)

    assert result.returncode == 0, result.stderr
    assert "WIRED-INFO-PROBE" in result.stdout


def test_log_level_env_is_documented() -> None:
    for relative_path in (".env.example", "README.md"):
        text = (REPO_ROOT / relative_path).read_text(encoding="utf-8")
        assert "NERDY_LOG_LEVEL" in text, f"{relative_path} must document NERDY_LOG_LEVEL"
