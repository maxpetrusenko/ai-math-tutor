from __future__ import annotations

from pathlib import Path


DOCKERFILE_PATH = Path(__file__).resolve().parents[2] / "backend" / "Dockerfile"


def test_backend_dockerfile_probes_session_healthz() -> None:
    dockerfile = DOCKERFILE_PATH.read_text(encoding="utf-8")

    assert "HEALTHCHECK" in dockerfile
    assert "http://127.0.0.1:8080/healthz" in dockerfile
