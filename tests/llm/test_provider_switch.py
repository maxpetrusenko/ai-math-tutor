from backend.llm.gemini_fallback_client import GeminiFallbackClient
from backend.llm.minimax_client import MiniMaxClient
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
