from __future__ import annotations

from pathlib import Path


WORKFLOW_PATH = Path(".github/workflows/fast-coolify-deploy.yml")
DOCS_PATH = Path("docs/coolify-fast-deploy.md")

EXPECTED_RUNTIME_APPS = {
    "backend": {
        "uuid": "jbglbhx2tegm7olw37rmy9zm",
        "image": "ai-math-tutor-backend",
        "port": "8080",
        "health": "/api/runtime-options",
    },
    "session": {
        "uuid": "gx7frryikdt0o7uqtgumzi72",
        "image": "ai-math-tutor-session",
        "port": "8080",
        "health": "/api/runtime-options",
    },
    "frontend": {
        "uuid": "nz1pemtpromq4ujwpu83zphm",
        "image": "ai-math-tutor-frontend",
        "port": "3000",
        "health": "/api/runtime/status",
    },
    "web": {
        "uuid": "rx0jx3ghadj7r2uemnhsl9kt",
        "image": "ai-math-tutor-web",
        "port": "3000",
        "health": "/api/runtime/status",
    },
}


def _deploy_matrix() -> str:
    workflow = WORKFLOW_PATH.read_text()
    deploy_section = workflow[workflow.index("  deploy:\n") :]
    matrix = deploy_section[deploy_section.index("          - app:") :]
    return matrix[: matrix.index("    steps:")]


def _app_block(matrix: str, app: str) -> str:
    marker = f"          - app: {app}\n"
    assert marker in matrix, f"deploy matrix is missing {app!r}"
    block = marker + matrix.split(marker, maxsplit=1)[1]
    next_app = "\n          - app:"
    if next_app in block:
        block = block.split(next_app, maxsplit=1)[0]
    return block


def test_coolify_deploy_matrix_targets_every_public_runtime_app() -> None:
    matrix = _deploy_matrix()

    for app, expected in EXPECTED_RUNTIME_APPS.items():
        block = _app_block(matrix, app)
        assert f"uuid: {expected['uuid']}" in block
        assert f"image: {expected['image']}" in block
        assert f"port: \"{expected['port']}\"" in block
        assert f"health: {expected['health']}" in block
        assert 'health_enabled: "true"' in block


def test_coolify_docs_match_runtime_deploy_matrix() -> None:
    docs = DOCS_PATH.read_text()

    for app, expected in EXPECTED_RUNTIME_APPS.items():
        assert f"`ghcr.io/maxpetrusenko/{expected['image']}`" in docs
        assert f"`ai-math-tutor-{app}` | `{expected['uuid']}`" in docs

    assert "`ai-math-tutor-web`" in docs
    assert "configured for `/Dockerfile`, but this repo has no root `Dockerfile`" not in docs
