from pathlib import Path


def test_production_readiness_queue_names_safe_landing_policy() -> None:
    runbook = Path("docs/production-readiness-queue.md").read_text()

    assert "# Production Readiness Queue" in runbook
    assert "Do not deploy or merge from this queue until the PR-specific gates pass" in runbook
    assert "## Current production baseline" in runbook
    assert "https://aitutor.maxpetrusenko.com" in runbook
    assert "listed Contabo/sslip roots return 404" in runbook


def test_production_readiness_queue_keeps_existing_prs_in_priority_order() -> None:
    runbook = Path("docs/production-readiness-queue.md").read_text()

    expected_order = [
        "#12",
        "#23",
        "#38",
        "#36",
        "#37",
        "#11",
    ]
    positions = [runbook.index(item) for item in expected_order]

    assert positions == sorted(positions)
    assert "No new deploy-side PR should duplicate #11, #23, #37, or the open healthcheck/smoke stack." in runbook
