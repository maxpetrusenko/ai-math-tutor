"""Guards for provider-registration import safety.

``backend/providers/config.py`` was a dead module: nothing in the repository
imported it, its provider defaults duplicated live env reads in
``backend/providers/__init__.py``, ``backend/providers/registry.py``, and
``backend/session/runtime_options.py``, and it executed
``auto_register_providers()`` as an import-time side effect. Baseline probe
on the pre-removal tree showed that importing it dragged in 3,461 additional
modules (including the langchain/openai/anthropic/google SDK stacks) and
registered every provider bucket before any caller asked for one.

These guards keep provider registration call-time only (via
``create_provider()``) and fail if the dead module - or any other
import-time registration - is reintroduced.
"""

from __future__ import annotations

import ast
import importlib.util
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
REMOVED_MODULE = "backend.providers.config"


def test_dead_provider_config_module_is_gone() -> None:
    assert not (BACKEND_ROOT / "providers" / "config.py").exists()
    assert importlib.util.find_spec(REMOVED_MODULE) is None


def test_no_backend_module_registers_providers_at_import_scope() -> None:
    offenders: list[str] = []
    for path in sorted(BACKEND_ROOT.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for call in _module_scope_calls(tree):
            if _call_name(call) == "auto_register_providers":
                offenders.append(str(path.relative_to(REPO_ROOT)))
    assert offenders == [], (
        "auto_register_providers() must only run when create_provider() is "
        f"called, not at import time; offenders: {offenders}"
    )


def _module_scope_calls(tree: ast.AST) -> list[ast.Call]:
    """Collect call expressions executed at import time (outside defs/lambdas)."""
    calls: list[ast.Call] = []

    def walk(node: ast.AST) -> None:
        for child in ast.iter_child_nodes(node):
            if isinstance(
                child,
                (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda),
            ):
                continue
            if isinstance(child, ast.Call):
                calls.append(child)
            walk(child)

    walk(tree)
    return calls


def _call_name(call: ast.Call) -> str | None:
    func = call.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


def test_importing_providers_package_does_not_register() -> None:
    """A bare ``import backend.providers`` must not register any providers."""
    code = (
        "import backend.providers\n"
        "from backend.providers.registry import ProviderRegistry as R\n"
        "print(sum(len(bucket) for bucket in ("
        "R._stt_providers, R._llm_providers, R._tts_providers, R._avatar_providers)))"
    )
    result = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "0", (
        "importing backend.providers registered providers; registration must "
        f"happen only inside create_provider(); stdout={result.stdout!r}"
    )
