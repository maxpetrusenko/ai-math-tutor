from backend.llm.anthropic_client import AnthropicClient
from backend.llm.gemini_fallback_client import (
    DEFAULT_GEMINI_LIVE_TIMEOUT_SECONDS,
    GeminiFallbackClient,
    MIN_GEMINI_LIVE_TIMEOUT_SECONDS,
    _resolve_live_timeout_seconds,
)
from backend.llm.minimax_client import MiniMaxClient
from backend.llm.openai_client import OpenAIClient
from backend.llm.provider_switch import ProviderSwitch
from backend.monitoring.latency_tracker import LatencyTracker


def test_gemini_fallback_matches_minimax_response_shape() -> None:
    tracker = LatencyTracker()
    client = GeminiFallbackClient()

    result = client.stream_response(
        messages=[{"role": "user", "content": "Help me solve for x."}],
        token_stream=["Let's break it down. ", "What should you isolate first?"],
        tracker=tracker,
        first_token_ts_ms=175,
    )

    assert result["provider"] == "gemini"
    assert result["text"].endswith("?")
    assert tracker.events[0].name == "llm_first_token"


def test_provider_switch_uses_fallback_when_primary_unavailable() -> None:
    tracker = LatencyTracker()
    switch = ProviderSwitch(primary=MiniMaxClient(), fallback=GeminiFallbackClient())

    result = switch.stream_response(
        messages=[{"role": "user", "content": "Help me solve for x."}],
        token_stream=["Good start. ", "What should you isolate first?"],
        tracker=tracker,
        first_token_ts_ms=120,
        use_fallback=True,
    )

    assert result["provider"] == "gemini"


def test_provider_switch_uses_env_backed_defaults(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_LLM_PROVIDER", "minimax")
    monkeypatch.setenv("NERDY_LLM_FALLBACK_PROVIDER", "gemini")
    tracker = LatencyTracker()
    switch = ProviderSwitch()

    primary_result = switch.stream_response(
        messages=[{"role": "user", "content": "Help me solve for x."}],
        token_stream=["Good start. ", "What should you isolate first?"],
        tracker=tracker,
        first_token_ts_ms=120,
    )
    fallback_result = switch.stream_response(
        messages=[{"role": "user", "content": "Help me solve for x."}],
        token_stream=["Let's break it down. ", "What should you isolate first?"],
        tracker=tracker,
        first_token_ts_ms=175,
        use_fallback=True,
    )

    assert primary_result["provider"] == "minimax"
    assert fallback_result["provider"] == "gemini"


def test_gemini_fallback_client_uses_live_api_when_key_present(monkeypatch) -> None:
    class _FakeChunk:
        def __init__(self, content: str) -> None:
            self.content = content

    class _FakeModel:
        def __init__(self, **kwargs) -> None:
            self.kwargs = kwargs

        def stream(self, messages):
            del messages
            yield _FakeChunk("Nice start. ")
            yield _FakeChunk("What should you isolate first?")

    perf_values = iter([10.0, 10.0, 10.12, 10.12, 10.12])
    tracker = LatencyTracker()
    client = GeminiFallbackClient()

    monkeypatch.setenv("GEMINI_API_KEY", "gemini-test")
    monkeypatch.setenv("NERDY_RUNTIME_LLM_MODEL", "gemini-2.5-flash")
    monkeypatch.setattr("backend.llm.gemini_fallback_client.load_local_env", lambda: [])
    monkeypatch.setattr("backend.llm.gemini_fallback_client.ChatGoogleGenerativeAI", _FakeModel)
    monkeypatch.setattr("backend.llm.gemini_fallback_client.time.perf_counter", lambda: next(perf_values))

    result = client.stream_response(
        messages=[{"role": "user", "content": "Help me solve for x."}],
        token_stream=["stub fallback"],
        tracker=tracker,
        first_token_ts_ms=1000,
    )

    assert result["provider"] == "gemini"
    assert result["text"] == "Nice start. What should you isolate first?"
    assert tracker.events[0].name == "llm_first_token"
    assert tracker.events[0].ts_ms == 1120.0
    assert tracker.events[0].metadata["mode"] == "live"


def test_openai_client_uses_live_api_when_key_present(monkeypatch) -> None:
    class _FakeChunk:
        def __init__(self, content: str) -> None:
            self.content = content

    class _FakeModel:
        def __init__(self, **kwargs) -> None:
            self.kwargs = kwargs

        def stream(self, messages):
            del messages
            yield _FakeChunk("Try one step. ")
            yield _FakeChunk("What happens if you isolate x?")

    perf_values = iter([20.0, 20.0, 20.15, 20.15, 20.15])
    tracker = LatencyTracker()
    client = OpenAIClient()

    monkeypatch.setenv("OPENAI_API_KEY", "openai-test")
    monkeypatch.setattr("backend.llm.langchain_chat_client.load_local_env", lambda: [])
    monkeypatch.setattr("backend.llm.openai_client.ChatOpenAI", _FakeModel)
    monkeypatch.setattr("backend.llm.langchain_chat_client.time.perf_counter", lambda: next(perf_values))

    result = client.stream_response(
        messages=[{"role": "user", "content": "Help me solve for x."}],
        token_stream=["stub fallback"],
        tracker=tracker,
        first_token_ts_ms=1000,
    )

    assert result["provider"] == "openai"
    assert result["text"] == "Try one step. What happens if you isolate x?"
    assert tracker.events[0].name == "llm_first_token"
    assert tracker.events[0].ts_ms == 1150.0
    assert tracker.events[0].metadata["mode"] == "live"


def test_anthropic_client_uses_live_api_when_key_present(monkeypatch) -> None:
    class _FakeChunk:
        def __init__(self, content: str) -> None:
            self.content = content

    class _FakeModel:
        def __init__(self, **kwargs) -> None:
            self.kwargs = kwargs

        def stream(self, messages):
            del messages
            yield _FakeChunk("Check the balance. ")
            yield _FakeChunk("Which inverse step should come first?")

    perf_values = iter([30.0, 30.0, 30.18, 30.18, 30.18])
    tracker = LatencyTracker()
    client = AnthropicClient()

    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-test")
    monkeypatch.setattr("backend.llm.langchain_chat_client.load_local_env", lambda: [])
    monkeypatch.setattr("backend.llm.anthropic_client.ChatAnthropic", _FakeModel)
    monkeypatch.setattr("backend.llm.langchain_chat_client.time.perf_counter", lambda: next(perf_values))

    result = client.stream_response(
        messages=[{"role": "user", "content": "Help me solve for x."}],
        token_stream=["stub fallback"],
        tracker=tracker,
        first_token_ts_ms=1000,
    )

    assert result["provider"] == "anthropic"
    assert result["text"] == "Check the balance. Which inverse step should come first?"
    assert tracker.events[0].name == "llm_first_token"
    assert tracker.events[0].ts_ms == 1180.0
    assert tracker.events[0].metadata["mode"] == "live"


def test_gemini_fallback_client_enforces_google_min_timeout(monkeypatch) -> None:
    captured_kwargs: dict[str, object] = {}

    class _FakeChunk:
        def __init__(self, content: str) -> None:
            self.content = content

    class _FakeModel:
        def __init__(self, **kwargs) -> None:
            captured_kwargs.update(kwargs)

        def stream(self, messages):
            del messages
            yield _FakeChunk("Try subtracting 4 first.")

    perf_values = iter([40.0, 40.0, 40.11, 40.11, 40.11])
    tracker = LatencyTracker()
    client = GeminiFallbackClient()

    monkeypatch.setenv("GEMINI_API_KEY", "gemini-test")
    monkeypatch.setenv("NERDY_LIVE_LLM_TIMEOUT_SECONDS", "4")
    monkeypatch.setattr("backend.llm.gemini_fallback_client.load_local_env", lambda: [])
    monkeypatch.setattr("backend.llm.gemini_fallback_client.ChatGoogleGenerativeAI", _FakeModel)
    monkeypatch.setattr("backend.llm.gemini_fallback_client.time.perf_counter", lambda: next(perf_values))

    result = client.stream_response(
        messages=[{"role": "user", "content": "Help me solve for x."}],
        token_stream=["stub fallback"],
        tracker=tracker,
        first_token_ts_ms=1000,
    )

    assert result["provider"] == "gemini"
    assert captured_kwargs["request_timeout"] == MIN_GEMINI_LIVE_TIMEOUT_SECONDS


def test_gemini_fallback_client_uses_default_timeout_when_env_invalid(monkeypatch) -> None:
    monkeypatch.setenv("NERDY_LIVE_LLM_TIMEOUT_SECONDS", "not-a-number")

    assert _resolve_live_timeout_seconds("NERDY_LIVE_LLM_TIMEOUT_SECONDS", DEFAULT_GEMINI_LIVE_TIMEOUT_SECONDS) == DEFAULT_GEMINI_LIVE_TIMEOUT_SECONDS
