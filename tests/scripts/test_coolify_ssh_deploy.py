from __future__ import annotations

import os
import subprocess
from pathlib import Path


def test_coolify_deploy_removes_private_key_file_after_success(tmp_path: Path) -> None:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    ssh_log = tmp_path / "ssh-key-path.txt"

    ssh_stub = fake_bin / "ssh"
    ssh_stub.write_text(
        """#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path

args = sys.argv[1:]
key_path = Path(args[args.index("-i") + 1])
if not key_path.exists():
    print(f"missing identity file while ssh runs: {key_path}", file=sys.stderr)
    raise SystemExit(9)
Path(os.environ["SSH_STUB_LOG"]).write_text(str(key_path))
sys.stdin.read()
"""
    )
    ssh_stub.chmod(0o755)

    env = {
        **os.environ,
        "PATH": f"{fake_bin}{os.pathsep}{os.environ['PATH']}",
        "HOME": str(tmp_path),
        "SSH_STUB_LOG": str(ssh_log),
        "COOLIFY_API_TOKEN": "test-token",
        "COOLIFY_SSH_PRIVATE_KEY": "-----BEGIN TEST KEY-----\nabc\n-----END TEST KEY-----",
        "COOLIFY_SSH_KNOWN_HOSTS": "coolify.example ssh-ed25519 AAAATEST",
        "COOLIFY_UUID": "app-uuid",
        "COOLIFY_IMAGE": "ghcr.io/maxpetrusenko/ai-math-tutor-session",
        "DOCKER_TAG": "sha-test",
        "COOLIFY_PORT": "8080",
        "COOLIFY_HEALTH_ENABLED": "true",
        "COOLIFY_HEALTH_PATH": "/api/runtime-options",
    }

    result = subprocess.run(
        ["bash", "scripts/coolify_ssh_deploy.sh"],
        cwd=Path(__file__).resolve().parents[2],
        env=env,
        capture_output=True,
        text=True,
        timeout=20,
    )

    assert result.returncode == 0, result.stderr + result.stdout
    key_path = Path(ssh_log.read_text())
    assert not key_path.exists()
    assert not list((tmp_path / ".ssh").glob("coolify_deploy_key*"))
