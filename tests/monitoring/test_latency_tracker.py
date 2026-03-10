from __future__ import annotations

import pytest

from backend.monitoring.latency_tracker import (
    REQUIRED_EVENT_NAMES,
    LatencyTracker,
    aggregate_stage_metrics,
)


def test_tracker_rejects_unknown_events() -> None:
    tracker = LatencyTracker()

    with pytest.raises(ValueError, match="unknown event"):
        tracker.mark("made_up_event", 10)


def test_tracker_records_required_events_and_stage_deltas() -> None:
    tracker = LatencyTracker()
    tracker.mark("speech_end", 100)
    tracker.mark("stt_final", 210, {"provider": "deepgram"})
    tracker.mark("llm_first_token", 320)
    tracker.mark("tts_first_audio", 410)

    assert REQUIRED_EVENT_NAMES[0] == "speech_end"
    assert tracker.events[1].metadata == {"provider": "deepgram"}
    assert tracker.stage_durations()["speech_end->stt_final"] == 110
    assert tracker.stage_durations()["stt_final->llm_first_token"] == 110
    assert tracker.stage_durations()["llm_first_token->tts_first_audio"] == 90


def test_aggregate_stage_metrics_computes_quantiles_and_failures() -> None:
    tracker_a = LatencyTracker()
    tracker_a.mark("speech_end", 0)
    tracker_a.mark("stt_final", 100)
    tracker_a.mark("llm_first_token", 180)
    tracker_a.mark("tts_first_audio", 300)

    tracker_b = LatencyTracker()
    tracker_b.mark("speech_end", 0)
    tracker_b.mark("stt_final", 300)
    tracker_b.mark("llm_first_token", 500)
    tracker_b.mark("tts_first_audio", 950)

    summary = aggregate_stage_metrics([tracker_a, tracker_b])

    assert summary["speech_end->stt_final"]["count"] == 2
    assert summary["speech_end->stt_final"]["p50_ms"] == 200
    assert summary["speech_end->stt_final"]["p95_ms"] == 290
    assert summary["speech_end->tts_first_audio"]["max_ms"] == 950
    assert summary["speech_end->tts_first_audio"]["failure_count"] == 1
