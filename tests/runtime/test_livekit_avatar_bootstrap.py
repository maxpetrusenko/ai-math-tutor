from backend.livekit.avatar_bootstrap import (
    _describe_simli_bootstrap_failure,
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
