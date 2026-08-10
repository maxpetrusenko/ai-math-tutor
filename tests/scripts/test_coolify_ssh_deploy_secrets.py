import base64
import os
import subprocess
import textwrap
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "coolify_ssh_deploy.sh"


def _write_executable(path: Path, content: str) -> None:
    path.write_text(textwrap.dedent(content).lstrip())
    path.chmod(0o755)


def test_coolify_api_token_is_not_exposed_in_ssh_argv(tmp_path: Path) -> None:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    capture_dir = tmp_path / "capture"
    home = tmp_path / "home"
    home.mkdir()

    _write_executable(
        fake_bin / "ssh-keyscan",
        '#!/usr/bin/env python3\nprint("example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFakeKnownHost")\n',
    )
    _write_executable(
        fake_bin / "ssh",
        "".join(
            [
                "#!/usr/bin/env python3\n",
                "import os\n",
                "import sys\n",
                "from pathlib import Path\n",
                "\n",
                "capture_dir = Path(os.environ['CAPTURE_DIR'])\n",
                "capture_dir.mkdir(parents=True, exist_ok=True)\n",
                "(capture_dir / 'ssh_args.txt').write_text('\\n'.join(sys.argv[1:]))\n",
                "(capture_dir / 'ssh_stdin.txt').write_text(sys.stdin.read())\n",
            ]
        ),
    )

    api_token = "sensitive-secret-value-for-argv-regression"
    encoded_api_token = base64.b64encode(api_token.encode()).decode()
    env = {
        **os.environ,
        "PATH": f"{fake_bin}:{os.environ['PATH']}",
        "HOME": str(home),
        "CAPTURE_DIR": str(capture_dir),
        "COOLIFY_API_TOKEN": api_token,
        "COOLIFY_SSH_PRIVATE_KEY": "fake-private-key",
        "COOLIFY_UUID": "app-uuid",
        "COOLIFY_IMAGE": "ghcr.io/maxpetrusenko/ai-math-tutor-web",
        "DOCKER_TAG": "sha-test",
        "COOLIFY_PORT": "3000",
        "COOLIFY_HEALTH_ENABLED": "true",
        "COOLIFY_HEALTH_PATH": "/api/runtime/status",
        "COOLIFY_SSH_HOST": "example.com",
        "COOLIFY_SSH_USER": "deploy",
    }

    subprocess.run(["bash", str(SCRIPT)], env=env, check=True, cwd=ROOT)

    ssh_args = (capture_dir / "ssh_args.txt").read_text()
    ssh_stdin = (capture_dir / "ssh_stdin.txt").read_text()

    subprocess.run(["bash", "-n"], input=ssh_stdin, text=True, check=True)
    assert api_token not in ssh_args
    assert encoded_api_token not in ssh_args
    assert encoded_api_token in ssh_stdin
