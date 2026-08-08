from pathlib import Path


def test_coolify_fast_deploy_documents_rollback_to_previous_sha_tag() -> None:
    runbook = Path("docs/coolify-fast-deploy.md").read_text()

    assert "## Rollback" in runbook
    assert "previous `sha-<commit>` tag" in runbook
    assert "DOCKER_TAG=sha-<previous-commit>" in runbook
    assert "bash scripts/coolify_ssh_deploy.sh" in runbook

    for env_key in [
        "COOLIFY_UUID",
        "COOLIFY_IMAGE",
        "COOLIFY_PORT",
        "COOLIFY_HEALTH_ENABLED",
        "COOLIFY_HEALTH_PATH",
    ]:
        assert env_key in runbook

    for app in ["session", "web", "avatar-worker"]:
        assert app in runbook

    assert "COOLIFY_HEALTH_ENABLED=false" in runbook
    assert "https://aitutor.maxpetrusenko.com" in runbook
    assert "https://aitutor-session.maxpetrusenko.com/api/runtime-options" in runbook
