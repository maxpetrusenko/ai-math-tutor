"""Guard the session app boot path against eager LLM provider SDK imports.

The session deployment serves health probes and lesson APIs before any tutor
turn runs. Importing the LangChain provider SDKs at process boot adds ~1.7s to
every start (deploys, restarts, crash recovery) for code paths the process may
never use. These tests keep the heavy SDK stacks out of the boot import graph so
they load lazily on first live model construction instead.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# Provider SDK stacks loaded on demand when a live LLM call is constructed.
PROVIDER_SDK_MODULES = (
    "anthropic",
    "google.genai",
    "langchain_anthropic",
    "langchain_google_genai",
    "langchain_openai",
    "openai",
)

# Extra modules that session boot must not pay for either: they are only
# needed once a logged AI call runs.
BOOT_PURITY_MODULES = PROVIDER_SDK_MODULES + ("langchain_core", "langsmith")


def _heavy_modules_after_import(target: str, heavy_modules: tuple[str, ...]) -> list[str]:
    """Import ``target`` in a fresh interpreter and report heavy modules loaded."""
    script = (
        "import json, sys\n"
        f"import {target}\n"
        f"print(json.dumps([name for name in {heavy_modules!r} if name in sys.modules]))\n"
    )
    completed = subprocess.run(
        [sys.executable, "-c", script],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(completed.stdout.strip().splitlines()[-1])


def test_session_server_import_avoids_provider_sdk_stacks() -> None:
    assert _heavy_modules_after_import("backend.session.server", BOOT_PURITY_MODULES) == []


def test_llm_client_modules_import_avoids_provider_sdks() -> None:
    for module in (
        "backend.llm.anthropic_client",
        "backend.llm.openai_client",
        "backend.llm.gemini_fallback_client",
    ):
        assert _heavy_modules_after_import(module, PROVIDER_SDK_MODULES) == [], module
