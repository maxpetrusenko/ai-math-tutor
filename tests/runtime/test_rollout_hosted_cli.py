from __future__ import annotations

from pathlib import Path

from backend.runtime.hosted_rollout import RolloutResult
from scripts import rollout_hosted
from scripts.rollout_hosted import build_parser, cmd_prod, cmd_promote, cmd_stage


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_build_parser_maps_stage_command() -> None:
    args = build_parser().parse_args(
        [
            "stage",
            "--stage-project",
            "stage-project",
            "--stage-backend-env-file",
            "stage.env",
        ]
    )

    assert args.func is cmd_stage


def test_build_parser_maps_prod_command() -> None:
    args = build_parser().parse_args(
        [
            "prod",
            "--prod-project",
            "prod-project",
            "--prod-backend-env-file",
            "prod.env",
        ]
    )

    assert args.func is cmd_prod


def test_build_parser_accepts_environment_specific_smoke_url() -> None:
    args = build_parser().parse_args(
        [
            "prod",
            "--prod-project",
            "prod-project",
            "--prod-backend-env-file",
            "prod.env",
            "--prod-smoke-url",
            "https://aitutor.maxpetrusenko.com/",
        ]
    )

    assert args.prod_smoke_url == "https://aitutor.maxpetrusenko.com/"


def test_rollout_target_smokes_generated_and_custom_frontend_urls(monkeypatch) -> None:
    smoked_urls: list[str] = []

    def fake_rollout_once(**kwargs) -> RolloutResult:
        return RolloutResult(
            firebase_project="prod-project",
            frontend_url="https://generated.hosted.app",
            session_service_url="https://session.run.app",
            session_ws_url="wss://session.run.app/ws/session",
            app_id="app-id",
            backend_image="image:abc123",
        )

    def fake_wait_for_smoke(*, frontend_url: str, timeout_seconds: int, revision_hint: str | None) -> None:
        smoked_urls.append(frontend_url)

    monkeypatch.setattr(rollout_hosted, "_rollout_once", fake_rollout_once)
    monkeypatch.setattr(rollout_hosted, "_wait_for_smoke", fake_wait_for_smoke)

    args = build_parser().parse_args(
        [
            "prod",
            "--prod-project",
            "prod-project",
            "--prod-backend-env-file",
            "prod.env",
            "--prod-smoke-url",
            "https://aitutor.maxpetrusenko.com/",
        ]
    )
    args.git_commit = "abc123"

    rollout_hosted._rollout_target(args, prefix="prod", label="prod")

    assert smoked_urls == ["https://generated.hosted.app", "https://aitutor.maxpetrusenko.com/"]


def test_hosted_rollout_workflow_passes_optional_smoke_urls() -> None:
    workflow = (REPO_ROOT / ".github" / "workflows" / "hosted-rollout.yml").read_text(encoding="utf-8")

    assert "STAGE_FRONTEND_SMOKE_URL" in workflow
    assert "--stage-smoke-url" in workflow
    assert "PROD_FRONTEND_SMOKE_URL" in workflow
    assert "--prod-smoke-url" in workflow


def test_build_parser_maps_promote_command() -> None:
    args = build_parser().parse_args(
        [
            "promote",
            "--stage-project",
            "stage-project",
            "--stage-backend-env-file",
            "stage.env",
            "--prod-project",
            "prod-project",
            "--prod-backend-env-file",
            "prod.env",
        ]
    )

    assert args.func is cmd_promote
