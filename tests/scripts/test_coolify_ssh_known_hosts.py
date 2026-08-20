from __future__ import annotations

import os
import shlex
import stat
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEPLOY_SCRIPT = REPO_ROOT / "scripts" / "coolify_ssh_deploy.sh"


def _write_executable(path: Path, body: str) -> None:
    path.write_text("#!/usr/bin/env bash\nset -euo pipefail\n" + body)
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def _base_env(tmp_path: Path, fake_bin: Path) -> dict[str, str]:
    return {
        **os.environ,
        "PATH": f"{fake_bin}{os.pathsep}{os.environ['PATH']}",
        "HOME": str(tmp_path / "home"),
        "COOLIFY_API_TOKEN": "coolify-token-123",
        "COOLIFY_SSH_PRIVATE_KEY": "-----BEGIN TEST KEY-----\nabc123\n-----END TEST KEY-----",
        "COOLIFY_UUID": "app-uuid-123",
        "COOLIFY_IMAGE": "ghcr.io/maxpetrusenko/ai-math-tutor-web",
        "DOCKER_TAG": "sha-test",
        "COOLIFY_PORT": "3000",
        "COOLIFY_HEALTH_ENABLED": "true",
        "COOLIFY_HEALTH_PATH": "/api/runtime/status",
        "COOLIFY_SSH_HOST": "203.0.113.10",
        "COOLIFY_SSH_USER": "deploy",
    }


def test_coolify_deploy_requires_pinned_known_hosts_before_networking(tmp_path: Path) -> None:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    keyscan_called = tmp_path / "ssh-keyscan-called"
    _write_executable(
        fake_bin / "ssh-keyscan",
        f"touch {shlex.quote(str(keyscan_called))}\nprintf '%s\\n' '203.0.113.10 ssh-ed25519 AAAATESTKEY'\n",
    )
    _write_executable(fake_bin / "ssh", "cat >/dev/null\n")
    env = _base_env(tmp_path, fake_bin)

    result = subprocess.run(
        ["bash", str(DEPLOY_SCRIPT)],
        cwd=REPO_ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 1
    assert "::error::Set COOLIFY_SSH_KNOWN_HOSTS" in result.stdout
    assert not keyscan_called.exists()


def test_coolify_deploy_docs_list_pinned_known_hosts_secret() -> None:
    docs = (REPO_ROOT / "docs" / "coolify-fast-deploy.md").read_text()
    readme = (REPO_ROOT / "README.md").read_text()

    assert "COOLIFY_SSH_PRIVATE_KEY" in docs
    assert "COOLIFY_SSH_KNOWN_HOSTS" in docs
    assert "COOLIFY_SSH_KNOWN_HOSTS" in readme
