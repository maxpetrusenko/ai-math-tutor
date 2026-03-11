from __future__ import annotations

from scripts.rollout_hosted import build_parser, cmd_prod, cmd_promote, cmd_stage


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
