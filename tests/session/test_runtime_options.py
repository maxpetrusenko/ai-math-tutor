from backend.llm.anthropic_client import DEFAULT_ANTHROPIC_MODEL
from backend.llm.openai_client import DEFAULT_OPENAI_MODEL
from backend.session.runtime_options import default_runtime_config, validate_runtime_config


def test_validate_runtime_config_accepts_openai_defaults() -> None:
    runtime = validate_runtime_config({"llm_provider": "openai"})

    assert runtime["llm_provider"] == "openai"
    assert runtime["llm_model"] == DEFAULT_OPENAI_MODEL


def test_validate_runtime_config_accepts_anthropic_defaults() -> None:
    runtime = validate_runtime_config({"llm_provider": "anthropic"})

    assert runtime["llm_provider"] == "anthropic"
    assert runtime["llm_model"] == DEFAULT_ANTHROPIC_MODEL


def test_default_runtime_config_uses_openai_when_requested(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_RUNTIME_LLM_PROVIDER", "openai")

    runtime = default_runtime_config()

    assert runtime["llm_provider"] == "openai"
    assert runtime["llm_model"] == DEFAULT_OPENAI_MODEL
