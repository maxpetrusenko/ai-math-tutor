from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = REPO_ROOT / ".github" / "workflows" / "fast-coolify-deploy.yml"
RUNBOOK = REPO_ROOT / "docs" / "coolify-fast-deploy.md"


def _run_command_after_step(contents: str, step_name: str) -> str:
    lines = contents.splitlines()
    for index, line in enumerate(lines):
        if line.strip() == f"- name: {step_name}":
            for candidate in lines[index + 1 :]:
                stripped = candidate.strip()
                if stripped.startswith("- name:"):
                    break
                if stripped.startswith("run: "):
                    return stripped.removeprefix("run: ")
    raise AssertionError(f"missing run command for {step_name!r}")


def test_fast_coolify_frontend_build_reuses_installed_dependencies() -> None:
    contents = WORKFLOW.read_text()

    assert _run_command_after_step(contents, "Install frontend deps") == "pnpm install --frozen-lockfile --dir frontend"
    assert _run_command_after_step(contents, "Frontend build") == "pnpm --dir frontend build"


def test_coolify_runbook_lists_direct_frontend_build_gate() -> None:
    contents = RUNBOOK.read_text()

    assert "- `pnpm --dir frontend build`" in contents
    assert "- `pnpm build`" not in contents
