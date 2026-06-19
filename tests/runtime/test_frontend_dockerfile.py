from pathlib import Path


DOCKERFILE_PATH = Path(__file__).resolve().parents[2] / "frontend" / "Dockerfile"


def test_frontend_dockerfile_probes_frontend_healthz() -> None:
    dockerfile = DOCKERFILE_PATH.read_text(encoding="utf-8")

    assert "HEALTHCHECK" in dockerfile
    assert "http://127.0.0.1:3000/healthz" in dockerfile
