from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DOCKERFILE = ROOT / "frontend" / "Dockerfile"
COOLIFY_WORKFLOW = ROOT / ".github" / "workflows" / "fast-coolify-deploy.yml"
PRODUCTION_SESSION_WS_URL = "wss://aitutor-session.maxpetrusenko.com/ws/session"


def test_frontend_dockerfile_requires_explicit_session_ws_build_arg() -> None:
    dockerfile = FRONTEND_DOCKERFILE.read_text()

    assert f"ARG NEXT_PUBLIC_SESSION_WS_URL={PRODUCTION_SESSION_WS_URL}" not in dockerfile
    assert "ARG NEXT_PUBLIC_SESSION_WS_URL" in dockerfile
    assert "NEXT_PUBLIC_SESSION_WS_URL must be set" in dockerfile
    assert "ws://*" in dockerfile
    assert "wss://*" in dockerfile

    validation_index = dockerfile.index("NEXT_PUBLIC_SESSION_WS_URL must be set")
    build_index = dockerfile.index("RUN pnpm build")
    env_index = dockerfile.index("ENV NEXT_PUBLIC_SESSION_WS_URL=$NEXT_PUBLIC_SESSION_WS_URL")
    assert validation_index < build_index
    assert env_index < build_index

    runtime_stage = dockerfile.split("FROM node:22-slim", maxsplit=1)[1]
    assert "ARG NEXT_PUBLIC_SESSION_WS_URL" in runtime_stage
    assert "ENV NEXT_PUBLIC_SESSION_WS_URL=$NEXT_PUBLIC_SESSION_WS_URL" in runtime_stage


def test_coolify_workflow_passes_session_ws_build_arg_explicitly() -> None:
    workflow = COOLIFY_WORKFLOW.read_text()

    assert f"PRODUCTION_SESSION_WS_URL: {PRODUCTION_SESSION_WS_URL}" in workflow
    assert "NEXT_PUBLIC_SESSION_WS_URL=${{ env.PRODUCTION_SESSION_WS_URL }}" in workflow
