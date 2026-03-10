import json

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


def test_gemini_fallback_client_uses_live_api_when_key_present(monkeypatch) -> None:
    class _FakeResponse:
        def __iter__(self):
            payload = {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": "Nice start. "},
                                {"text": "What should you isolate first?"},
                            ]
                        }
                    }
                ]
            }
            yield f"data: {json.dumps(payload)}\n".encode("utf-8")

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    perf_values = iter([10.0, 10.12])
    tracker = LatencyTracker()
    client = GeminiFallbackClient()

    monkeypatch.setenv("GEMINI_API_KEY", "gemini-test")
    monkeypatch.setenv("NERDY_RUNTIME_LLM_MODEL", "gemini-2.5-flash")
    monkeypatch.setattr("backend.llm.gemini_fallback_client.load_local_env", lambda: [])
    monkeypatch.setattr("backend.llm.gemini_fallback_client.request.urlopen", lambda *args, **kwargs: _FakeResponse())
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
