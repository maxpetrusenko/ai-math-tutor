"""Guard the Dependabot update configuration.

The deploy workflow and production Dockerfiles must stay covered by
Dependabot version updates so pinned workflow actions and production
base images do not rot silently (see the residual risks of the
workflow-action-pinning and base-image-pinning work).

Parses dependabot.yml without PyYAML so the guard stays hermetic under
the minimal dev dependency set.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEPENDABOT_YML = REPO_ROOT / ".github" / "dependabot.yml"
WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"
BACKEND_DIR = REPO_ROOT / "backend"
FRONTEND_DIR = REPO_ROOT / "frontend"

UPDATE_BLOCK_RE = re.compile(
    r'-\s*package-ecosystem:\s*"([a-z-]+)"(?P<body>.*?)(?=-\s*package-ecosystem:|\Z)',
    re.DOTALL,
)


def _read_dependabot_config() -> str:
    assert DEPENDABOT_YML.is_file(), (
        f"{DEPENDABOT_YML.relative_to(REPO_ROOT)} is missing; "
        "production dependencies are not covered by Dependabot updates."
    )
    return DEPENDABOT_YML.read_text(encoding="utf-8")


def _update_blocks(text: str) -> dict[tuple[str, str], str]:
    """Return {(ecosystem, directory): block} for every update entry."""
    first_content = next(
        (line for line in text.splitlines() if line.strip() and not line.lstrip().startswith("#")),
        "",
    )
    assert first_content.strip() == "version: 2", "dependabot.yml must declare version: 2"
    blocks: dict[tuple[str, str], str] = {}
    for match in UPDATE_BLOCK_RE.finditer(text):
        ecosystem = match.group(1)
        body = match.group("body")
        dir_match = re.search(r'directory:\s*"([^"]+)"', body)
        assert dir_match, f"update block for {ecosystem} is missing a directory"
        directory = dir_match.group(1)
        assert (ecosystem, directory) not in blocks, (
            f"duplicate dependabot update entry for {ecosystem} @ {directory}"
        )
        blocks[(ecosystem, directory)] = body
    return blocks


def _all_dockerfile_dirs() -> set[str]:
    dirs: set[str] = set()
    for dockerfile in [
        *BACKEND_DIR.glob("Dockerfile*"),
        *FRONTEND_DIR.glob("Dockerfile*"),
    ]:
        if dockerfile.is_file():
            dirs.add(str(dockerfile.parent.relative_to(REPO_ROOT)))
    return dirs


def test_dependabot_config_covers_every_production_manifest() -> None:
    text = _read_dependabot_config()
    blocks = _update_blocks(text)

    # Every production image Dockerfile directory needs a docker entry.
    for directory in sorted(_all_dockerfile_dirs()):
        assert ("docker", f"/{directory}") in blocks, (
            f"no docker dependabot entry for /{directory}; "
            "production base images there are not covered."
        )

    # Workflow actions need a github-actions entry.
    workflows = list(WORKFLOWS_DIR.glob("*.yml")) + list(WORKFLOWS_DIR.glob("*.yaml"))
    assert workflows, "expected at least one workflow under .github/workflows"
    assert ("github-actions", "/") in blocks, (
        "no github-actions dependabot entry for '/'; workflow action refs are not covered."
    )

    # Frontend npm manifests need an npm entry.
    assert (FRONTEND_DIR / "package.json").is_file()
    assert (FRONTEND_DIR / "pnpm-lock.yaml").is_file(), (
        "frontend pnpm-lock.yaml missing; dependabot npm updates cannot resolve."
    )
    assert ("npm", "/frontend") in blocks, (
        "no npm dependabot entry for /frontend; frontend dependencies are not covered."
    )

    # Root PEP 621 pyproject.toml needs a pip entry.
    assert (REPO_ROOT / "pyproject.toml").is_file()
    assert ("pip", "/") in blocks, (
        "no pip dependabot entry for '/'; backend Python dependencies are not covered."
    )


def test_dependabot_updates_are_weekly_and_bounded() -> None:
    text = _read_dependabot_config()
    blocks = _update_blocks(text)
    assert blocks, "dependabot.yml declares no update entries"

    for (ecosystem, directory), body in sorted(blocks.items()):
        assert re.search(r'interval:\s*"?weekly"?', body), (
            f"dependabot entry {ecosystem} @ {directory} must run on a weekly schedule"
        )
        assert re.search(r"open-pull-requests-limit:\s*\d+", body), (
            f"dependabot entry {ecosystem} @ {directory} must bound open PRs"
        )
