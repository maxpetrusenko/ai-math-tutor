import pytest

from backend.providers.stt.deepgram import DeepgramProvider
from backend.stt.provider import STTProviderFactory


def test_stt_provider_factory_defaults_to_deepgram() -> None:
    provider = STTProviderFactory().create()

    assert isinstance(provider, DeepgramProvider)


def test_stt_provider_factory_uses_env_default(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_STT_PROVIDER", "deepgram")

    provider = STTProviderFactory().create()

    assert isinstance(provider, DeepgramProvider)


def test_stt_provider_factory_rejects_unknown_provider() -> None:
    with pytest.raises(ValueError, match="unknown stt provider: mystery"):
        STTProviderFactory().create("mystery")
