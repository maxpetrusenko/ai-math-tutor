from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_fast_coolify_workflow_passes_frontend_runtime_metadata_build_args() -> None:
    workflow = (REPO_ROOT / ".github" / "workflows" / "fast-coolify-deploy.yml").read_text(
        encoding="utf-8"
    )

    assert "NERDY_FRONTEND_REVISION=${{ env.DOCKER_TAG }}" in workflow
    assert "NERDY_FRONTEND_SERVICE=${{ matrix.image }}" in workflow


def test_frontend_dockerfile_promotes_runtime_metadata_args_to_env() -> None:
    dockerfile = (REPO_ROOT / "frontend" / "Dockerfile").read_text(encoding="utf-8")
    runtime_stage = dockerfile.split("FROM node:22-slim")[-1]

    assert "ARG NERDY_FRONTEND_REVISION" in dockerfile
    assert "ARG NERDY_FRONTEND_SERVICE" in dockerfile
    assert "ENV NERDY_FRONTEND_REVISION=$NERDY_FRONTEND_REVISION" in dockerfile
    assert "ENV NERDY_FRONTEND_SERVICE=$NERDY_FRONTEND_SERVICE" in dockerfile
    assert "ARG NERDY_FRONTEND_REVISION" in runtime_stage
    assert "ARG NERDY_FRONTEND_SERVICE" in runtime_stage
    assert "ENV NERDY_FRONTEND_REVISION=$NERDY_FRONTEND_REVISION" in runtime_stage
    assert "ENV NERDY_FRONTEND_SERVICE=$NERDY_FRONTEND_SERVICE" in runtime_stage
