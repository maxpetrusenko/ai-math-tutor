from __future__ import annotations

from pathlib import Path


WORKFLOW_PATH = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "fast-coolify-deploy.yml"


def _top_level_permissions_block(text: str) -> str:
    lines = text.splitlines()
    start = lines.index("permissions:")
    block: list[str] = []
    for line in lines[start + 1 :]:
        if line and not line.startswith(" "):
            break
        block.append(line)
    return "\n".join(block)


def _job_blocks(text: str) -> dict[str, str]:
    lines = text.splitlines()
    start = lines.index("jobs:")
    jobs: dict[str, list[str]] = {}
    current_job: str | None = None

    for line in lines[start + 1 :]:
        if line.startswith("  ") and line.endswith(":") and not line.startswith("    "):
            current_job = line.strip()[:-1]
            jobs[current_job] = []
            continue
        if current_job:
            jobs[current_job].append(line)

    return {job: "\n".join(block) for job, block in jobs.items()}


def test_package_write_permission_is_limited_to_image_build_job() -> None:
    workflow = WORKFLOW_PATH.read_text()
    job_blocks = _job_blocks(workflow)
    package_write_jobs = sorted(
        job_name for job_name, block in job_blocks.items() if "packages: write" in block
    )

    assert "packages: write" not in _top_level_permissions_block(workflow)
    assert package_write_jobs == ["build-images"]
    assert "permissions:" in job_blocks["build-images"]
    assert "contents: read" in job_blocks["build-images"]
