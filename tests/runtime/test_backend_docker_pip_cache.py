from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DOCKERFILES = (
    REPO_ROOT / "backend" / "Dockerfile",
    REPO_ROOT / "backend" / "Dockerfile.worker",
)


def test_backend_dockerfiles_use_buildkit_pip_cache() -> None:
    for dockerfile in BACKEND_DOCKERFILES:
        contents = dockerfile.read_text()

        assert "# syntax=docker/dockerfile:" in contents, dockerfile
        assert "--mount=type=cache,target=/root/.cache/pip" in contents, dockerfile
        assert "rm -rf /root/.cache/pip" not in contents, dockerfile
