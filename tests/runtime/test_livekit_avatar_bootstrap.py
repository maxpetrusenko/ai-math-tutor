import asyncio
import importlib
import sys
import types

from backend.livekit.avatar_bootstrap import (
    _describe_liveavatar_bootstrap_failure,
    _describe_simli_bootstrap_failure,
    create_avatar_room_session,
    collect_avatar_bootstrap_errors,
    is_managed_avatar_provider_id,
    resolve_managed_avatar_metadata,
)


def test_managed_avatar_ids_are_recognized() -> None:
    assert is_managed_avatar_provider_id("simli-b97a7777-live") is True
    assert is_managed_avatar_provider_id("heygen-liveavatar-default") is True
    assert is_managed_avatar_provider_id("human-threejs-3d") is False


def test_simli_metadata_uses_default_face_id_when_env_missing() -> None:
    target = resolve_managed_avatar_metadata(
        "simli-b97a7777-live",
        {
            "NERDY_LIVEKIT_AGENT_INSTRUCTIONS": "Tutor mode",
            "NERDY_LIVEKIT_OPENAI_VOICE": "alloy",
        },
    )

    assert target.provider == "simli"
    assert target.avatar_id == "b97a7777-a82e-4925-ad14-861d62c32bec"
    assert target.metadata["instructions"] == "Tutor mode"


def test_liveavatar_metadata_prefers_liveavatar_env_aliases() -> None:
    target = resolve_managed_avatar_metadata(
        "heygen-liveavatar-default",
        {
            "LIVEAVATAR_AVATAR_ID": "avatar-123",
            "NERDY_LIVEKIT_OPENAI_VOICE": "verse",
        },
    )

    assert target.provider == "liveavatar"
    assert target.avatar_id == "avatar-123"
    assert target.metadata["voice"] == "verse"


def test_bootstrap_errors_require_provider_specific_keys() -> None:
    simli_errors = collect_avatar_bootstrap_errors(
        "simli-b97a7777-live",
        {
            "LIVEKIT_URL": "wss://example.livekit.cloud",
            "LIVEKIT_API_KEY": "key",
            "LIVEKIT_API_SECRET": "secret",
            "OPENAI_API_KEY": "openai",
        },
    )
    liveavatar_errors = collect_avatar_bootstrap_errors(
        "heygen-liveavatar-default",
        {
            "LIVEKIT_URL": "wss://example.livekit.cloud",
            "LIVEKIT_API_KEY": "key",
            "LIVEKIT_API_SECRET": "secret",
            "OPENAI_API_KEY": "openai",
        },
    )

    assert simli_errors == ["SIMLI_API_KEY is required for Simli avatar sessions."]
    assert liveavatar_errors == [
        "LIVEAVATAR_API_KEY or HEYGEN_API_KEY is required for HeyGen LiveAvatar sessions.",
        "LIVEAVATAR_AVATAR_ID or HEYGEN_AVATAR_ID is required for HeyGen LiveAvatar sessions.",
    ]


def test_invalid_simli_face_id_error_is_human_readable() -> None:
    message = _describe_simli_bootstrap_failure(
        "INVALID_FACE_ID",
        face_id="b97a7777-a82e-4925-ad14-861d62c32bec",
    )

    assert "Compose-compatible `SIMLI_FACE_ID`" in message


def test_invalid_liveavatar_key_error_is_human_readable() -> None:
    message = _describe_liveavatar_bootstrap_failure("Invalid API key")

    assert "LIVEAVATAR_API_KEY" in message
    assert "HEYGEN_API_KEY" in message
    assert "not enough" in message


def test_create_avatar_room_session_loads_local_env_when_explicit_env_missing(monkeypatch) -> None:
    loaded = {"count": 0}

    for key in (
        "LIVEKIT_URL",
        "LIVEKIT_API_KEY",
        "LIVEKIT_API_SECRET",
        "OPENAI_API_KEY",
        "SIMLI_API_KEY",
        "SIMLI_FACE_ID",
    ):
        monkeypatch.delenv(key, raising=False)

    def fake_load_local_env() -> None:
        loaded["count"] += 1
        monkeypatch.setenv("LIVEKIT_URL", "https://example.livekit.cloud")
        monkeypatch.setenv("LIVEKIT_API_KEY", "key")
        monkeypatch.setenv("LIVEKIT_API_SECRET", "secret")
        monkeypatch.setenv("OPENAI_API_KEY", "openai")
        monkeypatch.setenv("SIMLI_API_KEY", "simli")
        monkeypatch.setenv("SIMLI_FACE_ID", "compose-face")

    async def fake_validate(*_args, **_kwargs) -> None:
        return None

    monkeypatch.setattr("backend.livekit.avatar_bootstrap.load_local_env", fake_load_local_env)
    monkeypatch.setattr("backend.livekit.avatar_bootstrap._validate_simli_avatar_target", fake_validate)

    class FakeAccessToken:
        def __init__(self, *, api_key: str, api_secret: str) -> None:
            self.api_key = api_key
            self.api_secret = api_secret

        def with_identity(self, _identity: str):
            return self

        def with_name(self, _name: str):
            return self

        def with_metadata(self, _metadata: str):
            return self

        def with_grants(self, _grants: object):
            return self

        def with_ttl(self, _ttl: object):
            return self

        def to_jwt(self) -> str:
            return "fake-jwt"

    class FakeLiveKitAPI:
        def __init__(self, *, url: str, api_key: str, api_secret: str) -> None:
            self.url = url
            self.api_key = api_key
            self.api_secret = api_secret
            self.room = types.SimpleNamespace(create_room=self.create_room)
            self.agent_dispatch = types.SimpleNamespace(create_dispatch=self.create_dispatch)

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def create_room(self, _request: object) -> None:
            return None

        async def create_dispatch(self, _request: object) -> None:
            return None

    fake_api_module = types.SimpleNamespace(
        AccessToken=FakeAccessToken,
        CreateAgentDispatchRequest=lambda **kwargs: kwargs,
        CreateRoomRequest=lambda **kwargs: kwargs,
        LiveKitAPI=FakeLiveKitAPI,
        VideoGrants=lambda **kwargs: kwargs,
    )
    monkeypatch.setitem(sys.modules, "livekit", types.SimpleNamespace(api=fake_api_module))

    result = asyncio.run(create_avatar_room_session("simli-b97a7777-live"))

    assert loaded["count"] >= 1
    assert result["provider"] == "simli"
    assert result["token"] == "fake-jwt"
    assert result["url"] == "wss://example.livekit.cloud"


def test_avatar_agent_loads_local_env_at_import(monkeypatch) -> None:
    loaded = {"count": 0}

    def fake_load_local_env() -> None:
        loaded["count"] += 1

    monkeypatch.setattr("backend.runtime.local_env.load_local_env", fake_load_local_env)

    import backend.livekit.avatar_agent as avatar_agent_module

    importlib.reload(avatar_agent_module)

    assert loaded["count"] >= 1
