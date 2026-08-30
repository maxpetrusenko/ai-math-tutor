from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github" / "workflows" / "fast-coolify-deploy.yml"


def _workflow_step(named: str) -> str:
    workflow = WORKFLOW.read_text()
    marker = f"- name: {named}"
    assert marker in workflow
    step = workflow.split(marker, 1)[1]
    return step.split("\n      - name:", 1)[0]


def test_missing_coolify_ssh_key_fails_production_deploy() -> None:
    step = _workflow_step("Skip deploy when SSH secret is absent")

    assert "::error::COOLIFY_SSH_PRIVATE_KEY is not configured" in step
    assert "production deploy cannot run" in step
    assert "exit 1" in step


def test_deploy_docs_name_required_ssh_secret() -> None:
    readme = (ROOT / "README.md").read_text()
    runbook = (ROOT / "docs" / "coolify-fast-deploy.md").read_text()

    for doc in (readme, runbook):
        assert "COOLIFY_SSH_PRIVATE_KEY" in doc
        assert "COOLIFY_SSH_KNOWN_HOSTS" in doc
