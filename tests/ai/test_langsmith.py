from backend.ai.langsmith import enable_langsmith_tracing


def test_enable_langsmith_tracing_requires_opt_in_and_key() -> None:
    env: dict[str, str] = {}

    assert enable_langsmith_tracing("nerdy-runtime-llm", env=env) is False


def test_enable_langsmith_tracing_sets_expected_env_defaults() -> None:
    env = {
        "LANGCHAIN_TRACING_V2": "true",
        "LANGCHAIN_API_KEY": "ls-key",
        "LANGCHAIN_PROJECT": "nerdy-via-langchain",
    }

    enabled = enable_langsmith_tracing("nerdy-runtime-llm", env=env)

    assert enabled is True
    assert env["LANGSMITH_API_KEY"] == "ls-key"
    assert env["LANGSMITH_TRACING"] == "true"
    assert env["LANGCHAIN_TRACING_V2"] == "true"
    assert env["LANGSMITH_PROJECT"] == "nerdy-via-langchain"
    assert env["LANGCHAIN_PROJECT"] == "nerdy-via-langchain"
