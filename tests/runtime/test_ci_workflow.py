from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CI_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "ci.yml"


def test_ci_workflow_runs_required_predeploy_gates() -> None:
    workflow = CI_WORKFLOW.read_text()

    assert "pull_request:" in workflow
    assert "push:" in workflow
    assert "python3 -m pytest -q" in workflow
    assert "pnpm run test" in workflow
    assert "pnpm run typecheck" in workflow
    assert "pnpm run build" in workflow
    assert "pnpm --dir frontend install --frozen-lockfile" in workflow
