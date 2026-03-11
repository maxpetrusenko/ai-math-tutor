from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from backend.runtime.hosted_rollout import (
    apphosting_backend_url,
    build_cloud_build_command,
    build_rollout_ref_args,
    build_run_deploy_command,
    extract_json_payload,
    parse_env_file,
    service_url_to_ws_url,
    set_apphosting_secret,
    write_cloud_build_config_file,
)


def test_apphosting_backend_url_adds_https_scheme() -> None:
    assert apphosting_backend_url("example.us-east4.hosted.app") == "https://example.us-east4.hosted.app"


def test_service_url_to_ws_url_converts_https() -> None:
    assert (
        service_url_to_ws_url("https://example.us-east4.run.app/")
        == "wss://example.us-east4.run.app/ws/session"
    )


def test_build_rollout_ref_args_requires_one_ref() -> None:
    with pytest.raises(ValueError):
        build_rollout_ref_args(git_branch=None, git_commit=None)


def test_build_rollout_ref_args_rejects_both_ref_types() -> None:
    with pytest.raises(ValueError):
        build_rollout_ref_args(git_branch="main", git_commit="abc123")


def test_parse_env_file_supports_dotenv(tmp_path: Path) -> None:
    env_file = tmp_path / "deploy.env"
    env_file.write_text(
        'FOO=bar\nEMPTY=\nQUOTED="value with spaces"\nexport BAZ=qux\n',
        encoding="utf-8",
    )

    assert parse_env_file(env_file) == {
        "FOO": "bar",
        "EMPTY": "",
        "QUOTED": "value with spaces",
        "BAZ": "qux",
    }


def test_parse_env_file_supports_json(tmp_path: Path) -> None:
    env_file = tmp_path / "deploy.json"
    env_file.write_text(json.dumps({"FOO": "bar", "NUM": 7}), encoding="utf-8")

    assert parse_env_file(env_file) == {"FOO": "bar", "NUM": "7"}


def test_extract_json_payload_skips_firebase_progress_lines() -> None:
    payload = extract_json_payload(
        "- Preparing the list of your Firebase WEB apps\n"
        '✔ Preparing the list of your Firebase WEB apps\n{"status":"success","result":[]}\n'
    )

    assert json.loads(payload) == {"status": "success", "result": []}


def test_build_cloud_build_command_uses_repo_root_context(tmp_path: Path) -> None:
    config_file = tmp_path / "cloudbuild.json"
    command = build_cloud_build_command(
        project="demo-project",
        source_dir=tmp_path,
        config_file=config_file,
    )

    assert command == [
        "gcloud",
        "builds",
        "submit",
        str(tmp_path),
        "--project",
        "demo-project",
        "--config",
        str(config_file),
        "--suppress-logs",
    ]


def test_write_cloud_build_config_file_targets_backend_dockerfile(tmp_path: Path) -> None:
    handle = write_cloud_build_config_file(
        image="us-east4-docker.pkg.dev/demo/repo/backend:abc123",
        dockerfile=tmp_path / "backend" / "Dockerfile",
    )
    payload = json.loads(Path(handle.name).read_text(encoding="utf-8"))

    assert payload == {
        "steps": [
            {
                "name": "gcr.io/cloud-builders/docker",
                "args": [
                    "build",
                    "-f",
                    str(tmp_path / "backend" / "Dockerfile"),
                    "-t",
                    "us-east4-docker.pkg.dev/demo/repo/backend:abc123",
                    ".",
                ],
            }
        ],
        "images": ["us-east4-docker.pkg.dev/demo/repo/backend:abc123"],
    }


def test_build_run_deploy_command_points_to_env_file(tmp_path: Path) -> None:
    env_file = tmp_path / "deploy.json"
    command = build_run_deploy_command(
        project="demo-project",
        region="us-east4",
        service="ai-math-tutor-session",
        image="us-east4-docker.pkg.dev/demo/repo/backend:abc123",
        env_file=env_file,
    )

    assert command == [
        "gcloud",
        "run",
        "deploy",
        "ai-math-tutor-session",
        "--project",
        "demo-project",
        "--region",
        "us-east4",
        "--image",
        "us-east4-docker.pkg.dev/demo/repo/backend:abc123",
        "--allow-unauthenticated",
        "--memory",
        "1Gi",
        "--cpu",
        "1",
        "--concurrency",
        "20",
        "--max-instances",
        "3",
        "--env-vars-file",
        str(env_file),
    ]


def test_set_apphosting_secret_answers_no_to_yaml_prompt(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_run_command(
        args: list[str],
        *,
        cwd: Path | None = None,
        input_text: str | None = None,
        check: bool = True,
    ) -> None:
        captured["args"] = args
        captured["cwd"] = cwd
        captured["input_text"] = input_text
        captured["check"] = check

    monkeypatch.setattr("backend.runtime.hosted_rollout.run_command", fake_run_command)

    set_apphosting_secret(project="demo-project", secret_name="DEMO_SECRET", value="secret-value")

    assert captured["args"] == [
        "firebase",
        "apphosting:secrets:set",
        "DEMO_SECRET",
        "--project",
        "demo-project",
        "--data-file",
        captured["args"][6],
        "--force",
    ]
    assert str(captured["args"][6]).startswith(tempfile.gettempdir())
    assert captured["input_text"] == "n\n"
