from __future__ import annotations

from contextlib import contextmanager
import os
from typing import Any, Iterator, MutableMapping

from langsmith.run_helpers import trace, tracing_context


def enable_langsmith_tracing(project_name: str, *, env: MutableMapping[str, str] | None = None) -> bool:
    target_env = env if env is not None else os.environ
    tracing_enabled = target_env.get("NERDY_ENABLE_LANGSMITH", "").strip() == "1"
    tracing_enabled = tracing_enabled or target_env.get("LANGCHAIN_TRACING_V2", "").strip().lower() == "true"
    if not tracing_enabled:
        return False

    api_key = (target_env.get("LANGSMITH_API_KEY") or target_env.get("LANGCHAIN_API_KEY") or "").strip()
    if not api_key:
        return False

    resolved_project = (
        target_env.get("LANGSMITH_PROJECT")
        or target_env.get("LANGCHAIN_PROJECT")
        or project_name
    ).strip()
    target_env.setdefault("LANGSMITH_API_KEY", api_key)
    target_env.setdefault("LANGCHAIN_API_KEY", api_key)
    target_env.setdefault("LANGSMITH_TRACING", "true")
    target_env.setdefault("LANGCHAIN_TRACING_V2", "true")
    target_env.setdefault("LANGSMITH_PROJECT", resolved_project)
    target_env.setdefault("LANGCHAIN_PROJECT", resolved_project)
    return True


@contextmanager
def trace_langsmith_run(
    *,
    project_name: str,
    run_name: str,
    run_type: str,
    inputs: dict[str, Any],
    metadata: dict[str, Any] | None = None,
    env: MutableMapping[str, str] | None = None,
) -> Iterator[Any]:
    target_env = env if env is not None else os.environ
    enabled = enable_langsmith_tracing(project_name, env=target_env)
    resolved_project = (
        target_env.get("LANGSMITH_PROJECT")
        or target_env.get("LANGCHAIN_PROJECT")
        or project_name
    ).strip()
    with tracing_context(project_name=resolved_project, enabled=enabled):
        with trace(
            run_name,
            run_type=run_type,
            inputs=inputs,
            metadata=metadata,
            project_name=resolved_project,
        ) as run_tree:
            yield run_tree
