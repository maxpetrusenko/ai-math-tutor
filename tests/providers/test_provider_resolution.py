from backend.providers import create_provider
from backend.providers.llm.gemini import GeminiProvider
from backend.providers.llm.minimax import MiniMaxProvider
from backend.providers.stt.deepgram import DeepgramProvider
from backend.providers.tts.cartesia import CartesiaProvider
from backend.providers.tts.minimax import MiniMaxTTSProvider


def test_create_provider_resolves_stt_with_current_client(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_STT_PROVIDER", "deepgram")

    provider = create_provider("stt")

    assert isinstance(provider, DeepgramProvider)


def test_create_provider_resolves_tts_with_current_client(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_TTS_PROVIDER", "minimax")

    provider = create_provider("tts")

    assert isinstance(provider, MiniMaxTTSProvider)


def test_create_provider_keeps_cartesia_as_default_tts() -> None:
    provider = create_provider("tts", "cartesia")

    assert isinstance(provider, CartesiaProvider)


def test_create_provider_resolves_primary_llm(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_LLM_PROVIDER", "minimax")

    provider = create_provider("llm")

    assert isinstance(provider, MiniMaxProvider)


def test_create_provider_resolves_gemini_llm(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_LLM_PROVIDER", "gemini")

    provider = create_provider("llm")

    assert isinstance(provider, GeminiProvider)
