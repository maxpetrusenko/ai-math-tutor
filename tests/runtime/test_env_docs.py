"""Guard: the checked-in environment contract.

Every environment variable the app reads should be discoverable from the
checked-in examples:

- ``.env.example`` (repo root): backend / worker / local-dev surface.
- ``frontend/.env.example``: the browser-visible ``NEXT_PUBLIC_*`` surface.

Capture coverage (dominant idioms in this codebase):

1. Quoted ``"NERDY_*"`` / ``"NEXT_PUBLIC_*"`` literals anywhere in scanned
   sources, which also catches provider indirection maps such as
   ``backend/tts/provider.py`` (``{"minimax": "NERDY_TTS_VOICE_MINIMAX"}``)
   and helper call sites such as ``_resolve_live_timeout_seconds("NAME", ...)``.
2. Explicit env accessor reads: ``os.getenv`` / ``os.environ[...]`` /
   ``os.environ.get`` / bare ``getenv`` / bare ``environ`` reads. These also
   catch non-prefixed knobs such as ``STT_MODULES``.
3. Dict-style ``.get("NAME")`` reads where NAME is SCREAMING_SNAKE env-like
   (contains ``_``), e.g. ``resolved_env.get("LIVEAVATAR_IS_SANDBOX", ...)``.

Out of scope (intentionally): benchmark-only paths (``backend/benchmarks``),
tests, and host-injected variables (``K_SERVICE`` / ``K_REVISION`` /
``NODE_ENV`` / ``NEXT_DIST_DIR``).

Vars whose documentation is owned by an open draft PR are allowlisted with a
reason below and should be dropped from the allowlist when that PR lands.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ROOT_EXAMPLE = REPO_ROOT / ".env.example"
FRONTEND_EXAMPLE = REPO_ROOT / "frontend" / ".env.example"

BACKEND_DIR = REPO_ROOT / "backend"
BACKEND_EXCLUDED_PARTS = {"__pycache__", "benchmarks"}

FRONTEND_SCAN_DIRS = ("lib", "app", "components")
FRONTEND_SCAN_EXTRA_FILES = ("next.config.ts",)

# Documented by an open draft PR; remove the entry when that PR lands.
BACKEND_DOC_ALLOWLIST: dict[str, str] = {
    "NERDY_ALLOWED_ORIGINS": "docs owned by open draft PRs #56/#73",
    "NERDY_TURN_TRACE_DIR": "docs owned by open draft PR #55",
    "NERDY_SESSION_DATA_DIR": "docs owned by open draft PR #82",
}

_ENV_NAME = r"[A-Z][A-Z0-9_]{2,}"
_QUOTED_PREFIXED = re.compile(rf"[\"']((?:NERDY|NEXT_PUBLIC)_[A-Z0-9_]+)[\"']")
_ACCESSOR_READ = re.compile(rf"(?:os\.)?(?:getenv|environ(?:\.get)?)[\(\[]\s*[\"']({_ENV_NAME})[\"']")
_DICT_GET = re.compile(rf"\.get\(\s*[\"']({_ENV_NAME})[\"']")
_FRONTEND_ACCESS = re.compile(rf"process\.env(?:\[[\"']|\.)({_ENV_NAME})")


def _iter_backend_files() -> list[Path]:
    files = []
    for path in sorted(BACKEND_DIR.rglob("*.py")):
        if BACKEND_EXCLUDED_PARTS & set(path.parts):
            continue
        files.append(path)
    return files


def _iter_frontend_files() -> list[Path]:
    files: list[Path] = []
    for sub in FRONTEND_SCAN_DIRS:
        root = REPO_ROOT / "frontend" / sub
        for path in sorted(root.rglob("*")):
            if path.suffix not in (".ts", ".tsx"):
                continue
            if ".test." in path.name:
                continue
            files.append(path)
    for name in FRONTEND_SCAN_EXTRA_FILES:
        extra = REPO_ROOT / "frontend" / name
        if extra.exists():
            files.append(extra)
    return files


def _backend_env_names() -> set[str]:
    names: set[str] = set()
    for path in _iter_backend_files():
        text = path.read_text()
        names.update(_QUOTED_PREFIXED.findall(text))
        names.update(_ACCESSOR_READ.findall(text))
        names.update(name for name in _DICT_GET.findall(text) if "_" in name)
    return names


def _frontend_env_names() -> set[str]:
    names: set[str] = set()
    for path in _iter_frontend_files():
        text = path.read_text()
        names.update(_FRONTEND_ACCESS.findall(text))
        names.update(_QUOTED_PREFIXED.findall(text))
    return names


def _documented(example: Path) -> set[str]:
    pattern = re.compile(rf"^\s*(?:export\s+)?#?\s*({_ENV_NAME})\s*=")
    return {
        match.group(1)
        for line in example.read_text().splitlines()
        if (match := pattern.match(line))
    }


def test_backend_env_reads_are_documented() -> None:
    documented = _documented(ROOT_EXAMPLE)
    missing = {
        name
        for name in _backend_env_names()
        if name not in documented and name not in BACKEND_DOC_ALLOWLIST
    }
    assert not missing, (
        "Undocumented environment variables read by backend code. Add them to "
        f".env.example (or the allowlist with a reason): {sorted(missing)}"
    )


def test_frontend_public_env_reads_are_documented() -> None:
    documented = _documented(FRONTEND_EXAMPLE)
    missing = sorted(
        name
        for name in _frontend_env_names()
        if name.startswith("NEXT_PUBLIC_") and name not in documented
    )
    assert not missing, (
        "Undocumented NEXT_PUBLIC_* environment variables read by frontend code. "
        f"Add them to frontend/.env.example: {missing}"
    )


def test_capture_is_non_vacuous() -> None:
    backend_names = _backend_env_names()
    assert {"NERDY_AI_LOG_PATH", "NERDY_STT_PROVIDER", "NERDY_TTS_VOICE_CARTESIA"} <= backend_names
    assert len(backend_names) >= 30, f"backend scan captured too few names: {len(backend_names)}"

    frontend_names = _frontend_env_names()
    assert "NEXT_PUBLIC_SESSION_WS_URL" in frontend_names
    public_names = {name for name in frontend_names if name.startswith("NEXT_PUBLIC_")}
    assert len(public_names) >= 3, f"frontend scan captured too few names: {sorted(public_names)}"


def test_allowlist_entries_have_reasons() -> None:
    for name, reason in BACKEND_DOC_ALLOWLIST.items():
        assert name.startswith("NERDY_") or name.startswith("NEXT_PUBLIC_")
        assert reason.strip()
