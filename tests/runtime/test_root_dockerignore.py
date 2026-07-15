from pathlib import Path


DOCKERIGNORE_PATH = Path(__file__).resolve().parents[2] / ".dockerignore"


def _dockerignore_patterns() -> set[str]:
    return {
        line.strip()
        for line in DOCKERIGNORE_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }


def test_root_dockerignore_excludes_local_env_secret_files() -> None:
    """Cloud Build submits the repo root, so local env files must stay out of context."""
    patterns = _dockerignore_patterns()

    assert ".env" in patterns
    assert ".env.*" in patterns
    assert "frontend/.env.local" in patterns
    assert "frontend/.env.*" in patterns
