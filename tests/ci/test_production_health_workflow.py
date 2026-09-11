"""Wiring tests for the scheduled production health workflow.

The workflow is the only automated production detector this repo has between
deploys, so a broken trigger or missing probe invocation must fail CI loudly.
"""

from __future__ import annotations

from pathlib import Path

import yaml

WORKFLOW_PATH = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "production-health.yml"


def _workflow_data() -> dict:
    return yaml.safe_load(WORKFLOW_PATH.read_text(encoding="utf-8"))


def _triggers(data: dict) -> dict:
    # PyYAML parses the bare `on:` key as the boolean True.
    return data.get("on") or data.get(True) or {}


def test_production_health_workflow_runs_hourly_and_supports_manual_dispatch() -> None:
    data = _workflow_data()
    triggers = _triggers(data)

    schedule = triggers.get("schedule")
    assert isinstance(schedule, list) and len(schedule) == 1
    cron = str(schedule[0].get("cron", ""))
    minute, hour, rest = cron.split(" ", 2)
    assert hour == "*" and rest == "* * *", f"expected an hourly cron, got {cron!r}"
    assert minute.isdigit(), f"expected a fixed minute offset, got {cron!r}"
    assert "workflow_dispatch" in triggers
    assert not triggers.get("push"), "the between-deploy probe must not run on every push"


def test_production_health_workflow_runs_the_probe_with_issue_permission() -> None:
    data = _workflow_data()

    permissions = data.get("permissions") or {}
    assert permissions.get("contents") == "read"
    assert permissions.get("issues") == "write"

    steps = data["jobs"]["probe"]["steps"]
    assert isinstance(steps, list) and steps
    run_steps = [str(step.get("run", "")) for step in steps]
    probe_runs = [run for run in run_steps if "scripts/production_health.py" in run]
    assert len(probe_runs) == 1, "expected exactly one step to invoke the production health probe"
    assert "--manage-issue" in probe_runs[0]
    assert "--github-repo" in probe_runs[0]
