"""Guard: every GitHub Action `uses:` ref in repo workflows must be pinned to a full commit SHA.

Floating major tags (e.g. `actions/checkout@v4`) allow a tag to be re-pointed to a
different commit after our last review. This workflow builds GHCR images and drives
production deploys with COOLIFY_SSH_PRIVATE_KEY / COOLIFY_API_TOKEN in scope, so an
unpinned action is a supply-chain path into the production deploy path.

The guard rejects any `uses:` line that is not `owner/repo@<40-hex-sha>` and requires
a trailing `# owner/repo@tag` comment so reviewers can see which release the SHA
corresponds to without resolving it by hand. GitHub's runner parses `uses:` as
`owner/repo@ref`, so the owner/repo prefix is required (a bare SHA has no owner
segment and cannot be resolved).
"""

from __future__ import annotations

import re
from pathlib import Path

WORKFLOW_DIR = Path(__file__).resolve().parents[2] / ".github" / "workflows"

PINNED_REF = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+@[0-9a-fA-F]{40}$")
PINNED_LINE = re.compile(
    r"^\s*uses:\s*([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+@[0-9a-fA-F]{40})\s+#\s*\S+@\S+\s*$"
)


def _workflow_files() -> list[Path]:
    return sorted(WORKFLOW_DIR.glob("*.yml")) + sorted(WORKFLOW_DIR.glob("*.yaml"))


def _uses_lines(workflow: Path) -> list[tuple[int, str]]:
    lines: list[tuple[int, str]] = []
    for line_no, line in enumerate(workflow.read_text().splitlines(), start=1):
        if re.match(r"^\s*uses:\s*\S+", line):
            lines.append((line_no, line))
    return lines


def test_every_action_is_pinned_to_full_commit_sha() -> None:
    workflows = _workflow_files()
    assert workflows, "expected at least one workflow file under .github/workflows/"

    unpinned: list[str] = []
    for workflow in workflows:
        for line_no, line in _uses_lines(workflow):
            ref = line.strip().split()[1]
            if not PINNED_REF.fullmatch(ref):
                unpinned.append(f"{workflow.name}:{line_no}: uses {ref!r}")

    assert not unpinned, (
        "unpinned action refs found (pin each as `owner/repo@<40-hex-commit-sha>`):\n"
        + "\n".join(unpinned)
    )


def test_pinned_action_lines_carry_version_comment() -> None:
    workflows = _workflow_files()
    missing: list[str] = []
    for workflow in workflows:
        for line_no, line in _uses_lines(workflow):
            if not PINNED_LINE.match(line):
                missing.append(f"{workflow.name}:{line_no}: {line.strip()}")
    assert not missing, (
        "pinned action lines must look like `uses: owner/repo@<40-hex-sha> # owner/repo@tag`:\n"
        + "\n".join(missing)
    )
