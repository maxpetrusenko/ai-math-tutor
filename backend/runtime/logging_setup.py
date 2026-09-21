"""Application logging bootstrap for session processes.

uvicorn (the production entrypoint, see ``backend/Dockerfile``) configures only
its own ``uvicorn*`` loggers and never touches the root logger. Python's root
logger defaults to WARNING with no handlers, so without this bootstrap every
application INFO record — session lifecycle, AI call summaries, transcript
resolution — is silently dropped in production containers, and WARNING+ records
leak to stderr through the stdlib ``lastResort`` handler without a stable
format.

``configure_logging()`` installs one stdout handler with a stable format and a
level from ``NERDY_LOG_LEVEL`` (default ``INFO``). It deliberately does nothing
when the root logger already has handlers, so embedders that configure logging
first (pytest capture, ``uvicorn --log-config`` users, notebooks) keep
ownership, and repeated calls never duplicate the handler.
"""
from __future__ import annotations

import logging
import os
import sys
from typing import IO

DEFAULT_LOG_LEVEL = "INFO"
LOG_LEVEL_ENV = "NERDY_LOG_LEVEL"
LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


def resolve_log_level(raw_value: str | None = None) -> int:
    """Resolve a logging level from ``NERDY_LOG_LEVEL`` (or an explicit value).

    Accepts standard level names case-insensitively (``debug``, ``WARNING``).
    Missing or unrecognized values fall back to INFO.
    """
    value = (raw_value if raw_value is not None else os.getenv(LOG_LEVEL_ENV, "")).strip().upper()
    if not value:
        return logging.INFO
    level = logging.getLevelName(value)
    if isinstance(level, int):
        return level
    return logging.INFO


def configure_logging(*, level: int | None = None, stream: IO[str] | None = None) -> bool:
    """Install the application log handler on the root logger if unconfigured.

    Returns True when this call installed the handler, False when the root
    logger was already owned by someone else (or by an earlier call).
    """
    root = logging.getLogger()
    if root.handlers:
        return False

    resolved_level = level if level is not None else resolve_log_level()
    handler = logging.StreamHandler(stream if stream is not None else sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    root.addHandler(handler)
    root.setLevel(resolved_level)

    if level is None:
        raw_value = os.getenv(LOG_LEVEL_ENV, "")
        if raw_value.strip() and not isinstance(logging.getLevelName(raw_value.strip().upper()), int):
            logging.getLogger(__name__).warning(
                "invalid %s=%r; using %s",
                LOG_LEVEL_ENV,
                raw_value,
                logging.getLevelName(resolved_level),
            )
    return True
