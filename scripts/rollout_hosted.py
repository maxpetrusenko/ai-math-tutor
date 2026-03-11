from __future__ import annotations

import argparse
import time
from pathlib import Path

from backend.runtime.hosted_rollout import (
    DEFAULT_FRONTEND_BACKEND,
    DEFAULT_FRONTEND_DISPLAY_NAME,
    DEFAULT_REGION,
    DEFAULT_SESSION_SERVICE,
    DEFAULT_SMOKE_TIMEOUT_SECONDS,
    DeployTarget,
    RolloutResult,
    apphosting_backend_url,
    deploy_session_backend,
    ensure_apphosting_backend,
    ensure_web_app,
    firebase_web_config_json,
    rollout_frontend,
    service_url_to_ws_url,
    set_apphosting_secret,
    smoke_frontend,
)


REPO_ROOT = Path(__file__).resolve().parents[1]


def _default_git_commit() -> str:
    from backend.runtime.hosted_rollout import run_command

    completed = run_command(["git", "rev-parse", "HEAD"], cwd=REPO_ROOT)
    return completed.stdout.strip()


def _image_tag_from_commit(git_commit: str) -> str:
    return git_commit[:12]


def _deploy_target(args: argparse.Namespace, *, prefix: str) -> DeployTarget:
    firebase_project = getattr(args, f"{prefix}_project")
    backend_env_file = Path(getattr(args, f"{prefix}_backend_env_file")).expanduser().resolve()
    app_id = getattr(args, f"{prefix}_app_id")
    frontend_backend = getattr(args, f"{prefix}_frontend_backend")
    frontend_display_name = getattr(args, f"{prefix}_frontend_display_name")
    session_service = getattr(args, f"{prefix}_session_service")
    region = getattr(args, f"{prefix}_region")
    return DeployTarget(
        firebase_project=firebase_project,
        backend_env_file=backend_env_file,
        app_id=app_id,
        frontend_backend=frontend_backend,
        frontend_display_name=frontend_display_name,
        session_service=session_service,
        region=region,
    )


def _rollout_once(
    *,
    target: DeployTarget,
    git_branch: str | None,
    git_commit: str,
) -> RolloutResult:
    app_id = ensure_web_app(
        project=target.firebase_project,
        display_name=target.frontend_display_name,
        app_id=target.app_id,
    )
    backend = ensure_apphosting_backend(
        project=target.firebase_project,
        backend_id=target.frontend_backend,
        app_id=app_id,
        region=target.region,
    )
    frontend_url = apphosting_backend_url(str(backend["uri"]))
    set_apphosting_secret(
        project=target.firebase_project,
        secret_name="FIREBASE_WEBAPP_CONFIG",
        value=firebase_web_config_json(project=target.firebase_project, app_id=app_id),
    )
    image_tag = _image_tag_from_commit(git_commit)
    backend_image, session_service_url = deploy_session_backend(
        repo_root=REPO_ROOT,
        target=target,
        frontend_url=frontend_url,
        image_tag=image_tag,
    )
    session_ws_url = service_url_to_ws_url(session_service_url)
    set_apphosting_secret(
        project=target.firebase_project,
        secret_name="SESSION_WS_URL",
        value=session_ws_url,
    )
    rollout_frontend(
        project=target.firebase_project,
        backend_id=target.frontend_backend,
        git_branch=git_branch,
        git_commit=git_commit,
    )
    return RolloutResult(
        firebase_project=target.firebase_project,
        frontend_url=frontend_url,
        session_service_url=session_service_url,
        session_ws_url=session_ws_url,
        app_id=app_id,
        backend_image=backend_image,
    )


def _wait_for_smoke(*, frontend_url: str, timeout_seconds: int, revision_hint: str | None) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_stdout = ""
    last_stderr = ""
    while time.monotonic() < deadline:
        completed = smoke_frontend(
            repo_root=REPO_ROOT,
            frontend_url=frontend_url,
            expect_revision_contains=revision_hint,
        )
        if completed.returncode == 0:
            return
        last_stdout = completed.stdout.strip()
        last_stderr = completed.stderr.strip()
        time.sleep(10)
    detail = last_stderr or last_stdout or f"smoke timed out after {timeout_seconds}s"
    raise RuntimeError(detail)


def _rollout_target(args: argparse.Namespace, *, prefix: str, label: str) -> RolloutResult:
    git_commit = args.git_commit or _default_git_commit()
    target = _deploy_target(args, prefix=prefix)
    result = _rollout_once(target=target, git_branch=args.git_branch, git_commit=git_commit)
    _wait_for_smoke(
        frontend_url=result.frontend_url,
        timeout_seconds=args.smoke_timeout_seconds,
        revision_hint=args.expect_revision_contains,
    )
    print(f"{label} frontend={result.frontend_url}")
    print(f"{label} session={result.session_service_url}")
    print(f"{label} image={result.backend_image}")
    return result


def cmd_stage(args: argparse.Namespace) -> int:
    _rollout_target(args, prefix="stage", label="stage")
    return 0


def cmd_prod(args: argparse.Namespace) -> int:
    _rollout_target(args, prefix="prod", label="prod")
    return 0


def cmd_promote(args: argparse.Namespace) -> int:
    stage_result = _rollout_target(args, prefix="stage", label="stage")
    prod_result = _rollout_target(args, prefix="prod", label="prod")
    print(f"stage frontend={stage_result.frontend_url}")
    print(f"prod frontend={prod_result.frontend_url}")
    print(f"prod session={prod_result.session_service_url}")
    return 0


def _add_git_ref_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--git-branch")
    parser.add_argument("--git-commit")
    parser.add_argument("--expect-revision-contains")
    parser.add_argument("--smoke-timeout-seconds", type=int, default=DEFAULT_SMOKE_TIMEOUT_SECONDS)


def _add_target_args(parser: argparse.ArgumentParser, *, prefix: str) -> None:
    parser.add_argument(f"--{prefix}-project", required=True)
    parser.add_argument(f"--{prefix}-backend-env-file", required=True)
    parser.add_argument(f"--{prefix}-app-id")
    parser.add_argument(f"--{prefix}-frontend-backend", default=DEFAULT_FRONTEND_BACKEND)
    parser.add_argument(f"--{prefix}-frontend-display-name", default=DEFAULT_FRONTEND_DISPLAY_NAME)
    parser.add_argument(f"--{prefix}-session-service", default=DEFAULT_SESSION_SERVICE)
    parser.add_argument(f"--{prefix}-region", default=DEFAULT_REGION)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Roll out hosted staging and prod environments.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    stage_parser = subparsers.add_parser("stage")
    _add_target_args(stage_parser, prefix="stage")
    _add_git_ref_args(stage_parser)
    stage_parser.set_defaults(func=cmd_stage)

    prod_parser = subparsers.add_parser("prod")
    _add_target_args(prod_parser, prefix="prod")
    _add_git_ref_args(prod_parser)
    prod_parser.set_defaults(func=cmd_prod)

    promote_parser = subparsers.add_parser("promote")
    _add_target_args(promote_parser, prefix="stage")
    _add_target_args(promote_parser, prefix="prod")
    _add_git_ref_args(promote_parser)
    promote_parser.set_defaults(func=cmd_promote)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.git_branch and args.git_commit:
        parser.error("use either --git-branch or --git-commit")
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
