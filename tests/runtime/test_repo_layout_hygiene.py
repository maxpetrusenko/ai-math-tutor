"""Guards against stray build inputs forked into the production repo.

The repository carried a vendored copy of the LiveKit Agents Python starter
template under ``maxpetrusenko/`` (added in 50d2880 alongside the livekit
avatar work). Nothing built, imported, or referenced it: it is not part of
the ``nerdy`` package (``[tool.setuptools.packages.find]`` includes only
``backend*`` and ``eval*``), no workflow, script, or manifest referenced it,
and its Dockerfile cannot build as committed because it ``COPY``s a
``uv.lock`` that the starter template intentionally does not ship. Left in
place it duplicated the Dockerfile / Python-manifest / workflow surface that
production tooling (Dependabot, dependency scans, coding agents) then has to
disambiguate.

These guards pin the production build surface: the root ``pyproject.toml``,
Dockerfiles under ``backend/`` and ``frontend/`` only, and workflow files
only in the repository-root ``.github/workflows/`` directory.

Scope: a tripwire for realistic reintroduction paths (restoring the
directory, or copying a manifest / Dockerfile / workflow file back in). It
does not follow directory symlinks, prunes conventional build/cache output
directories (``build/``, ``dist/``, ``.next/``, ``node_modules/``, ...),
and matches the removed directory name case-sensitively; those locations
are not consumed as build inputs by any production workflow or package
manifest.
"""

from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# Build outputs, caches, and dependency trees that can exist in a working
# checkout without being tracked build inputs.
_SKIP_DIR_NAMES = frozenset(
    {
        ".git",
        ".venv",
        ".next",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
        ".nerdy-data",
        ".turbo",
        "__pycache__",
        "node_modules",
        "venv",
        "dist",
        "build",
        "coverage",
        "htmlcov",
    }
)

_ALLOWED_DOCKERFILE_DIRS = frozenset({"backend", "frontend"})


def _iter_repo_files() -> list[Path]:
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(REPO_ROOT):
        dirnames[:] = sorted(name for name in dirnames if name not in _SKIP_DIR_NAMES)
        files.extend(Path(dirpath) / name for name in sorted(filenames))
    return files


def test_vendored_livekit_starter_directory_is_gone() -> None:
    assert not (REPO_ROOT / "maxpetrusenko").exists()
    offenders = [
        str(path.relative_to(REPO_ROOT))
        for path in _iter_repo_files()
        if path.relative_to(REPO_ROOT).parts[0] == "maxpetrusenko"
    ]
    assert offenders == [], f"vendored starter files reintroduced: {offenders}"


def test_dockerfiles_live_only_under_production_dirs() -> None:
    offenders = [
        str(path.relative_to(REPO_ROOT))
        for path in _iter_repo_files()
        if (path.name == "Dockerfile" or path.name.startswith("Dockerfile."))
        and path.relative_to(REPO_ROOT).parts[0] not in _ALLOWED_DOCKERFILE_DIRS
    ]
    assert offenders == [], (
        "Dockerfile* files must live under backend/ or frontend/ so the "
        f"production workflows build and pin them; found: {offenders}"
    )


def test_only_root_python_package_manifest() -> None:
    offenders = [
        str(path.relative_to(REPO_ROOT))
        for path in _iter_repo_files()
        if path.name == "pyproject.toml" and path.parent != REPO_ROOT
    ]
    assert offenders == [], (
        "the only Python package manifest is the root pyproject.toml "
        f"(packages: backend*, eval*); found: {offenders}"
    )


def test_no_workflows_outside_root_workflow_dir() -> None:
    offenders = [
        str(path.relative_to(REPO_ROOT))
        for path in _iter_repo_files()
        if path.suffix in {".yml", ".yaml"} and _is_nested_workflow(path)
    ]
    assert offenders == [], (
        "GitHub Actions only runs workflows from the repository-root "
        f".github/workflows/; nested copies are dead config: {offenders}"
    )


def _is_nested_workflow(path: Path) -> bool:
    parts = path.relative_to(REPO_ROOT).parts
    try:
        index = parts.index(".github")
    except ValueError:
        return False
    return index > 0 and parts[index + 1 : index + 2] == ("workflows",)
