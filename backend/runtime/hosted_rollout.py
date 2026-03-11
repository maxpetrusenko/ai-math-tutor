from __future__ import annotations

import json
import os
import shlex
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_REGION = "us-east4"
DEFAULT_FRONTEND_BACKEND = "ai-math-tutor"
DEFAULT_FRONTEND_DISPLAY_NAME = "ai-math-tutor"
DEFAULT_SESSION_SERVICE = "ai-math-tutor-session"
DEFAULT_ARTIFACT_REPOSITORY = "cloud-run-source-deploy"
DEFAULT_SESSION_IMAGE_NAME = "ai-math-tutor-session"
DEFAULT_SMOKE_TIMEOUT_SECONDS = 900


@dataclass(frozen=True)
class DeployTarget:
    firebase_project: str
    backend_env_file: Path
    app_id: str | None = None
    frontend_backend: str = DEFAULT_FRONTEND_BACKEND
    frontend_display_name: str = DEFAULT_FRONTEND_DISPLAY_NAME
    session_service: str = DEFAULT_SESSION_SERVICE
    region: str = DEFAULT_REGION
    session_image_name: str = DEFAULT_SESSION_IMAGE_NAME
    artifact_repository: str = DEFAULT_ARTIFACT_REPOSITORY


@dataclass(frozen=True)
class RolloutResult:
    firebase_project: str
    frontend_url: str
    session_service_url: str
    session_ws_url: str
    app_id: str
    backend_image: str


def normalize_url(url: str) -> str:
    normalized = url.strip()
    if not normalized:
        raise ValueError("URL is required.")
    return normalized.rstrip("/")


def apphosting_backend_url(uri: str) -> str:
    normalized = uri.strip()
    if not normalized:
        raise ValueError("App Hosting backend URI is required.")
    if normalized.startswith("http://") or normalized.startswith("https://"):
        return normalize_url(normalized)
    return f"https://{normalized}"


def service_url_to_ws_url(service_url: str) -> str:
    normalized = normalize_url(service_url)
    if normalized.startswith("https://"):
        return f"wss://{normalized.removeprefix('https://')}/ws/session"
    if normalized.startswith("http://"):
        return f"ws://{normalized.removeprefix('http://')}/ws/session"
    raise ValueError(f"Unsupported service URL: {service_url!r}")


def build_rollout_ref_args(*, git_branch: str | None, git_commit: str | None) -> list[str]:
    branch = (git_branch or "").strip()
    commit = (git_commit or "").strip()
    if branch and commit:
        raise ValueError("Specify either git_branch or git_commit, not both.")
    if branch:
        return ["--git-branch", branch]
    if commit:
        return ["--git-commit", commit]
    raise ValueError("A git branch or git commit is required.")


def parse_env_file(path: Path) -> dict[str, str]:
    suffix = path.suffix.lower()
    raw_text = path.read_text(encoding="utf-8")
    if suffix == ".json":
        payload = json.loads(raw_text)
        if not isinstance(payload, dict):
            raise ValueError(f"{path} must contain a JSON object.")
        return {str(key): str(value) for key, value in payload.items()}

    env_vars: dict[str, str] = {}
    for line in raw_text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("export "):
            stripped = stripped[len("export ") :].strip()
        if "=" not in stripped:
            raise ValueError(f"Unsupported env line in {path}: {line!r}")
        key, raw_value = stripped.split("=", 1)
        key = key.strip()
        value = raw_value.strip()
        if value and value[0] in {'"', "'"}:
            value = shlex.split(f"token={value}", comments=False, posix=True)[0].split("=", 1)[1]
        env_vars[key] = value
    return env_vars


def write_env_json_file(env_vars: dict[str, str]) -> tempfile.NamedTemporaryFile:
    handle = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    json.dump(env_vars, handle, indent=2, sort_keys=True)
    handle.flush()
    handle.close()
    return handle


def write_cloud_build_config_file(*, image: str, dockerfile: Path) -> tempfile.NamedTemporaryFile:
    handle = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    json.dump(
        {
            "steps": [
                {
                    "name": "gcr.io/cloud-builders/docker",
                    "args": ["build", "-f", str(dockerfile), "-t", image, "."],
                }
            ],
            "images": [image],
        },
        handle,
        indent=2,
    )
    handle.flush()
    handle.close()
    return handle


def build_cloud_build_command(*, project: str, source_dir: Path, config_file: Path) -> list[str]:
    return [
        "gcloud",
        "builds",
        "submit",
        str(source_dir),
        "--project",
        project,
        "--config",
        str(config_file),
        "--suppress-logs",
    ]


def build_run_deploy_command(
    *,
    project: str,
    region: str,
    service: str,
    image: str,
    env_file: Path,
    max_instances: int = 3,
    memory: str = "1Gi",
    cpu: str = "1",
    concurrency: int = 20,
) -> list[str]:
    return [
        "gcloud",
        "run",
        "deploy",
        service,
        "--project",
        project,
        "--region",
        region,
        "--image",
        image,
        "--allow-unauthenticated",
        "--memory",
        memory,
        "--cpu",
        cpu,
        "--concurrency",
        str(concurrency),
        "--max-instances",
        str(max_instances),
        "--env-vars-file",
        str(env_file),
    ]


def run_command(
    args: list[str],
    *,
    cwd: Path | None = None,
    input_text: str | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    completed = subprocess.run(
        args,
        cwd=str(cwd) if cwd else None,
        input=input_text,
        capture_output=True,
        text=True,
        check=False,
    )
    if check and completed.returncode != 0:
        stdout = completed.stdout.strip()
        stderr = completed.stderr.strip()
        detail = stderr or stdout or f"exit code {completed.returncode}"
        raise RuntimeError(f"Command failed: {' '.join(args)}\n{detail}")
    return completed


def run_json_command(args: list[str], *, cwd: Path | None = None) -> Any:
    completed = run_command(args, cwd=cwd)
    payload = completed.stdout.strip()
    if not payload:
        raise RuntimeError(f"Command returned no JSON: {' '.join(args)}")
    return json.loads(extract_json_payload(payload))


def extract_json_payload(output: str) -> str:
    stripped = output.strip()
    for marker in ('{"status"', "{", "["):
        index = stripped.find(marker)
        if index >= 0:
            return stripped[index:]
    raise ValueError(f"Could not locate JSON payload in output: {output!r}")


def ensure_artifact_repository(*, project: str, region: str, repository: str) -> None:
    describe = run_command(
        [
            "gcloud",
            "artifacts",
            "repositories",
            "describe",
            repository,
            "--project",
            project,
            "--location",
            region,
        ],
        check=False,
    )
    if describe.returncode == 0:
        return
    run_command(
        [
            "gcloud",
            "artifacts",
            "repositories",
            "create",
            repository,
            "--project",
            project,
            "--location",
            region,
            "--repository-format",
            "docker",
            "--description",
            "Hosted rollout backend images",
        ]
    )


def ensure_web_app(*, project: str, display_name: str, app_id: str | None = None) -> str:
    if app_id:
        return app_id

    payload = run_json_command(["firebase", "apps:list", "WEB", "--project", project, "--json"])
    apps = payload.get("result") or []
    if len(apps) == 1:
        return str(apps[0]["appId"])
    if len(apps) > 1:
        for candidate in apps:
            if str(candidate.get("displayName") or "").strip() == display_name:
                return str(candidate["appId"])
        raise RuntimeError(f"Multiple WEB apps found in {project}; pass --app-id explicitly.")

    created = run_json_command(
        ["firebase", "apps:create", "WEB", display_name, "--project", project, "--json"]
    )
    return str((created.get("result") or {})["appId"])


def firebase_web_config_json(*, project: str, app_id: str) -> str:
    payload = run_json_command(
        ["firebase", "apps:sdkconfig", "WEB", app_id, "--project", project, "--json"]
    )
    result = payload.get("result") or {}
    file_contents = result.get("fileContents")
    if not isinstance(file_contents, str) or not file_contents.strip():
        raise RuntimeError(f"Could not read Firebase web config for {app_id}.")
    return file_contents.strip()


def ensure_apphosting_backend(
    *,
    project: str,
    backend_id: str,
    app_id: str,
    region: str,
    root_dir: str = "/",
) -> dict[str, Any]:
    existing = run_command(
        [
            "firebase",
            "apphosting:backends:get",
            backend_id,
            "--project",
            project,
            "--json",
        ],
        check=False,
    )
    if existing.returncode == 0:
        return json.loads(existing.stdout)["result"]

    created = run_json_command(
        [
            "firebase",
            "apphosting:backends:create",
            "--backend",
            backend_id,
            "--app",
            app_id,
            "--primary-region",
            region,
            "--root-dir",
            root_dir,
            "--project",
            project,
            "--json",
            "--non-interactive",
        ]
    )
    return created["result"]


def set_apphosting_secret(*, project: str, secret_name: str, value: str) -> None:
    with tempfile.NamedTemporaryFile(mode="w", delete=False) as handle:
        handle.write(value)
        handle.flush()
        data_file = handle.name
    try:
        run_command(
            [
                "firebase",
                "apphosting:secrets:set",
                secret_name,
                "--project",
                project,
                "--data-file",
                data_file,
                "--force",
            ],
            # Firebase may still prompt to edit apphosting.yaml in non-TTY CI even
            # when the secret is already declared. Answering "no" keeps the command
            # non-interactive while preserving the committed config.
            input_text="n\n",
        )
    finally:
        try:
            os.unlink(data_file)
        except FileNotFoundError:
            pass


def build_backend_image_uri(*, project: str, region: str, repository: str, image_name: str, tag: str) -> str:
    return f"{region}-docker.pkg.dev/{project}/{repository}/{image_name}:{tag}"


def deploy_session_backend(
    *,
    repo_root: Path,
    target: DeployTarget,
    frontend_url: str,
    image_tag: str,
) -> tuple[str, str]:
    ensure_artifact_repository(
        project=target.firebase_project,
        region=target.region,
        repository=target.artifact_repository,
    )
    image = build_backend_image_uri(
        project=target.firebase_project,
        region=target.region,
        repository=target.artifact_repository,
        image_name=target.session_image_name,
        tag=image_tag,
    )
    build_config = write_cloud_build_config_file(image=image, dockerfile=Path("backend") / "Dockerfile")
    try:
        run_command(
            build_cloud_build_command(
                project=target.firebase_project,
                source_dir=repo_root,
                config_file=Path(build_config.name),
            )
        )
    finally:
        try:
            os.unlink(build_config.name)
        except FileNotFoundError:
            pass

    env_vars = parse_env_file(target.backend_env_file)
    env_vars["NERDY_ALLOWED_ORIGINS"] = normalize_url(frontend_url)
    env_vars["NERDY_REQUIRE_FIREBASE_AUTH"] = "1"
    env_file_handle = write_env_json_file(env_vars)
    try:
        run_command(
            build_run_deploy_command(
                project=target.firebase_project,
                region=target.region,
                service=target.session_service,
                image=image,
                env_file=Path(env_file_handle.name),
            )
        )
    finally:
        try:
            os.unlink(env_file_handle.name)
        except FileNotFoundError:
            pass
    service_payload = run_json_command(
        [
            "gcloud",
            "run",
            "services",
            "describe",
            target.session_service,
            "--project",
            target.firebase_project,
            "--region",
            target.region,
            "--format=json",
        ]
    )
    service_url = str((service_payload.get("status") or {})["url"])
    return image, normalize_url(service_url)


def rollout_frontend(*, project: str, backend_id: str, git_branch: str | None, git_commit: str | None) -> None:
    args = [
        "firebase",
        "apphosting:rollouts:create",
        backend_id,
        "--project",
        project,
        "--force",
        *build_rollout_ref_args(git_branch=git_branch, git_commit=git_commit),
    ]
    run_command(args)


def smoke_frontend(
    *,
    repo_root: Path,
    frontend_url: str,
    expect_revision_contains: str | None = None,
) -> subprocess.CompletedProcess[str]:
    args = [
        "python3",
        "scripts/smoke_hosted.py",
        "--frontend-url",
        normalize_url(frontend_url),
        "--expect-firebase",
        "--expect-auth",
    ]
    if expect_revision_contains:
        args.extend(["--expect-revision-contains", expect_revision_contains])
    return run_command(args, cwd=repo_root, check=False)
