from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_IGNORE = REPO_ROOT / "frontend" / ".dockerignore"


def _ignore_entries() -> set[str]:
    return {
        line.strip()
        for line in FRONTEND_IGNORE.read_text().splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }


def test_frontend_docker_context_has_its_own_ignore_file() -> None:
    workflow = (REPO_ROOT / ".github" / "workflows" / "fast-coolify-deploy.yml").read_text()
    dockerfile = (REPO_ROOT / "frontend" / "Dockerfile").read_text()

    assert "context: frontend" in workflow
    assert "COPY . ." in dockerfile
    assert FRONTEND_IGNORE.exists()


def test_frontend_docker_context_excludes_local_build_and_secret_artifacts() -> None:
    entries = _ignore_entries()

    assert {
        ".env",
        ".env.*",
        "node_modules",
        ".next",
        ".next-dev",
        ".turbo",
        "coverage",
        "test-results",
        "playwright-report",
        "*.tsbuildinfo",
    }.issubset(entries)
