from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _deploy_job_matrix_apps(workflow: str) -> set[str]:
    deploy_job = workflow.split("\n  deploy:\n", 1)[1]
    deploy_matrix = deploy_job.split("\n    steps:", 1)[0]
    return set(re.findall(r"\n\s+- app: ([a-z0-9-]+)\n", deploy_matrix))


def _markdown_table_apps(section: str) -> set[str]:
    return set(re.findall(r"^\| `([^`]+)` \|", section, flags=re.MULTILINE))


def test_coolify_runbook_deployed_apps_match_workflow_matrix() -> None:
    workflow = (ROOT / ".github/workflows/fast-coolify-deploy.yml").read_text(encoding="utf-8")
    runbook = (ROOT / "docs/coolify-fast-deploy.md").read_text(encoding="utf-8")

    deployed_section = runbook.split("Deployed by the workflow:", 1)[1].split(
        "Built but not deployed by the workflow:", 1
    )[0]

    assert _markdown_table_apps(deployed_section) == _deploy_job_matrix_apps(workflow)


def test_coolify_runbook_documents_workflow_secret_contract() -> None:
    runbook = (ROOT / "docs/coolify-fast-deploy.md").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")

    for key in ("COOLIFY_SSH_PRIVATE_KEY", "COOLIFY_API_TOKEN", "COOLIFY_TOKEN"):
        assert key in runbook
        assert key in readme

    assert "COOLIFY_URL" not in runbook
    assert "COOLIFY_URL" not in readme
