from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DOCKERFILE = REPO_ROOT / "backend" / "Dockerfile"


def test_backend_api_image_defines_runtime_options_healthcheck() -> None:
    contents = BACKEND_DOCKERFILE.read_text()

    assert "HEALTHCHECK" in contents
    assert "/api/runtime-options" in contents
    assert "curl -fsS" in contents
    assert "${PORT:-8080}" in contents
