from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DOCKERFILE = REPO_ROOT / "backend" / "Dockerfile"
FRONTEND_DOCKERFILE = REPO_ROOT / "frontend" / "Dockerfile"


def _dockerfile_lines(path: Path) -> list[str]:
    return [line.strip() for line in path.read_text().splitlines() if line.strip() and not line.strip().startswith("#")]


def test_backend_runtime_image_runs_as_non_root_user_with_writable_state_dir() -> None:
    lines = _dockerfile_lines(BACKEND_DOCKERFILE)

    assert "RUN groupadd --system nerdy && useradd --system --gid nerdy --home-dir /app nerdy" in lines
    assert "RUN mkdir -p /app/.nerdy-data && chown -R nerdy:nerdy /app/.nerdy-data" in lines
    assert "USER nerdy" in lines
    assert lines.index("USER nerdy") < lines.index('CMD ["uvicorn", "backend.session.server:app", "--host", "0.0.0.0", "--port", "8080"]')


def test_frontend_runtime_image_runs_next_server_as_non_root_user() -> None:
    lines = _dockerfile_lines(FRONTEND_DOCKERFILE)

    assert "RUN groupadd --system nerdy && useradd --system --gid nerdy --home-dir /app nerdy" in lines
    assert "RUN chown -R nerdy:nerdy /app" in lines
    assert "USER nerdy" in lines
    assert lines.index("USER nerdy") < lines.index('CMD ["node", "server.js"]')
