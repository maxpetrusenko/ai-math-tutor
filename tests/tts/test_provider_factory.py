from backend.tts.provider import TTSProviderFactory


def test_tts_provider_factory_defaults_to_cartesia() -> None:
    provider = TTSProviderFactory().create()

    assert provider.provider_name == "cartesia"


def test_tts_provider_factory_can_switch_to_minimax() -> None:
    provider = TTSProviderFactory().create("minimax")

    assert provider.provider_name == "minimax"


def test_tts_provider_factory_uses_env_default(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_TTS_PROVIDER", "minimax")

    provider = TTSProviderFactory().create()

    assert provider.provider_name == "minimax"


def test_tts_provider_factory_uses_provider_specific_voice_defaults(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_TTS_VOICE_MINIMAX", "teacher-warm")

    voice_config = TTSProviderFactory().default_voice_config("minimax")

    assert voice_config == {"voice_id": "teacher-warm"}
