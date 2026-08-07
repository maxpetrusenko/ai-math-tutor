from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# Dockerfiles that produce production images via .github/workflows/fast-coolify-deploy.yml
# (ai-math-tutor-backend, ai-math-tutor-session, ai-math-tutor-avatar-worker,
# ai-math-tutor-frontend, ai-math-tutor-web).
PRODUCTION_DOCKERFILES = [
    REPO_ROOT / "backend" / "Dockerfile",
    REPO_ROOT / "backend" / "Dockerfile.worker",
    REPO_ROOT / "frontend" / "Dockerfile",
]

# Requires image:tag@sha256:<64 hex> so the base image is both readable and immutable.
PINNED_FROM_RE = re.compile(
    r"^FROM\s+[^\s@]+:[^\s@]+@sha256:[0-9a-f]{64}(?:\s+AS\s+[A-Za-z_][A-Za-z0-9_]*)?\s*$"
)


def test_production_dockerfiles_pin_base_images_to_digests() -> None:
    for path in PRODUCTION_DOCKERFILES:
        dockerfile = path.read_text(encoding="utf-8")
        from_lines = [line for line in dockerfile.splitlines() if line.startswith("FROM ")]
        assert from_lines, f"{path} has no FROM line"
        for line in from_lines:
            assert PINNED_FROM_RE.match(line), (
                f"{path} has an unpinned FROM line: {line!r}\n"
                "Pin production base images to immutable digests, e.g.\n"
                "FROM python:3.11.15-slim@sha256:94c50be2dc994b873b55bc123e95e6dbade08095b3dfd790f51c34de3f08cbb7"
            )
