"""Test that the avatar-worker Dockerfile runs as a non-root user.

REGRESSION: guards against re-introducing root-level process privilege
inside the avatar-worker container.

The worker does not write local state (no session persistence, no AI call logs),
so no state directory is needed — only a narrow system user to contain runtime
privilege.
"""

from __future__ import annotations

import re


def test_worker_dockerfile_has_non_root_user() -> None:
    """The final USER directive must switch to a non-root user before CMD."""
    dockerfile_path = __file__.rsplit("/", 1)[0] + "/../../backend/Dockerfile.worker"
    dockerfile_path = dockerfile_path.replace("/tests/runtime/../runtime/..", "/tests/runtime/..")
    dockerfile_path = f"/tmp/ai-math-tutor-pr/backend/Dockerfile.worker"

    with open(dockerfile_path) as fh:
        content = fh.read()

    # Find all USER directives in order
    user_lines = [line.strip() for line in content.splitlines() if line.strip().startswith("USER ")]

    assert len(user_lines) >= 1, (
        f"backend/Dockerfile.worker has no USER directive — "
        "the avatar-worker process currently runs as root inside the container. "
        "Add 'RUN useradd --system --disabled-password --no-create-home nerdy' "
        "and 'USER nerdy' before CMD to contain privilege."
    )

    final_user = user_lines[-1]
    user_name = final_user.split()[1]

    assert user_name != "root", (
        f"backend/Dockerfile.worker final USER directive is 'USER {user_name}' — "
        "the avatar-worker container still inherits root privilege. "
        "Switch to a dedicated app user (e.g., 'USER nerdy')."
    )
