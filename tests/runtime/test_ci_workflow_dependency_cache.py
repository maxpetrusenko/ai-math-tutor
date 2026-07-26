from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = REPO_ROOT / ".github" / "workflows" / "fast-coolify-deploy.yml"


def _step_block(contents: str, step_name: str) -> str:
    marker = f"      - name: {step_name}\n"
    start = contents.index(marker)
    next_step = contents.find("\n      - name: ", start + len(marker))
    if next_step == -1:
        return contents[start:]
    return contents[start:next_step]


def test_gates_cache_python_dependencies_from_pyproject() -> None:
    workflow = WORKFLOW.read_text()

    setup_python = _step_block(workflow, "Set up Python")

    assert "uses: actions/setup-python@v5" in setup_python
    assert "cache: pip" in setup_python
    assert "cache-dependency-path: pyproject.toml" in setup_python
