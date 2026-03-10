from backend.llm.minimax_client import MiniMaxClient
from backend.monitoring.latency_tracker import LatencyTracker


def test_minimax_client_marks_first_token_and_shapes_output() -> None:
    tracker = LatencyTracker()
    client = MiniMaxClient()

    result = client.stream_response(
        messages=[{"role": "user", "content": "Help me solve for x."}],
        token_stream=["Nice start. ", "Subtract 5 from both sides. ", "What should you do next?"],
        tracker=tracker,
        first_token_ts_ms=150,
    )

    assert result["text"].endswith("?")
    assert tracker.events[0].name == "llm_first_token"
    assert tracker.events[0].metadata["provider"] == "minimax"
