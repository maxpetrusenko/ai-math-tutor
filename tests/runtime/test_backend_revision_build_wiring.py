from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

BACKEND_MATRIX_ENTRIES = (
    ("backend", "ai-math-tutor-backend"),
    ("session", "ai-math-tutor-session"),
)
NON_BACKEND_MATRIX_IMAGES = (
    "ai-math-tutor-avatar-worker",
    "ai-math-tutor-frontend",
    "ai-math-tutor-web",
)
REVISION_BUILD_ARG = "NERDY_BACKEND_REVISION=sha-${{ github.sha }}"


def _workflow_text() -> str:
    return (REPO_ROOT / ".github" / "workflows" / "fast-coolify-deploy.yml").read_text(
        encoding="utf-8"
    )


def _matrix_entry_text(workflow: str, app: str) -> str:
    start = workflow.index(f"- app: {app}\n")
    next_entry = workflow.find("\n          - app:", start)
    text = workflow[start : next_entry if next_entry != -1 else len(workflow)]
    return text + "\n"


def _build_step_text(workflow: str) -> str:
    start = workflow.index("Build and push image")
    next_step = workflow.find("\n      - ", start)
    return workflow[start : next_step if next_step != -1 else len(workflow)]


def test_fast_coolify_workflow_scopes_revision_build_arg_to_backend_images() -> None:
    workflow = _workflow_text()

    for app, image in BACKEND_MATRIX_ENTRIES:
        entry = _matrix_entry_text(workflow, app)
        assert f"image: {image}\n" in entry
        assert "dockerfile: backend/Dockerfile\n" in entry
        assert f"build_args: {REVISION_BUILD_ARG}\n" in entry

    for image in NON_BACKEND_MATRIX_IMAGES:
        assert "build_args:" not in _matrix_entry_text(workflow, image.removeprefix("ai-math-tutor-"))


def test_fast_coolify_workflow_passes_matrix_build_args_to_build_step() -> None:
    step = _build_step_text(_workflow_text())

    assert "build-args:" in step
    assert "${{ matrix.build_args }}" in step


def test_backend_dockerfile_bakes_revision_env() -> None:
    dockerfile = (REPO_ROOT / "backend" / "Dockerfile").read_text(encoding="utf-8")

    assert "ARG NERDY_BACKEND_REVISION" in dockerfile
    assert "ENV NERDY_BACKEND_REVISION=$NERDY_BACKEND_REVISION" in dockerfile


def test_deploy_docs_explain_revision_verification() -> None:
    docs = (REPO_ROOT / "docs" / "coolify-fast-deploy.md").read_text(encoding="utf-8")

    assert "NERDY_BACKEND_REVISION" in docs
    assert "/api/runtime-options" in docs
    assert ".revision" in docs
