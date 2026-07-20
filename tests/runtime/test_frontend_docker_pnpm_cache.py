from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DOCKERFILE = REPO_ROOT / "frontend" / "Dockerfile"


def test_frontend_dockerfile_caches_pnpm_store_between_builds() -> None:
    dockerfile = FRONTEND_DOCKERFILE.read_text()

    assert dockerfile.startswith("# syntax=docker/dockerfile:")
    assert "--mount=type=cache" in dockerfile
    assert "id=ai-math-tutor-frontend-pnpm-store" in dockerfile
    assert "target=/pnpm/store" in dockerfile
    assert "pnpm install --frozen-lockfile --store-dir /pnpm/store" in dockerfile
