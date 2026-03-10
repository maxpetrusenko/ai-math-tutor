from __future__ import annotations

from backend.benchmarks.run_latency_benchmark import (
    BenchmarkOutcome,
    load_canned_prompts,
    run_benchmark,
)
from backend.monitoring.latency_tracker import LatencyTracker


def test_load_canned_prompts_reads_fixture() -> None:
    prompts = load_canned_prompts("backend/benchmarks/canned_prompts.json")

    assert len(prompts) == 3
    assert prompts[0].subject == "math"


def test_run_benchmark_executes_30_runs_per_prompt_and_computes_gate() -> None:
    call_count = 0

    def fake_pipeline(prompt_id: str, iteration: int) -> LatencyTracker:
        nonlocal call_count
        call_count += 1
        tracker = LatencyTracker()
        tracker.mark("speech_end", 0)
        tracker.mark("stt_final", 100 + (iteration % 3) * 10)
        tracker.mark("llm_first_token", 180 + (iteration % 2) * 10)
        tracker.mark("tts_first_audio", 420 + (iteration % 4) * 20)
        return tracker

    outcome = run_benchmark(
        "backend/benchmarks/canned_prompts.json",
        pipeline=fake_pipeline,
    )

    assert isinstance(outcome, BenchmarkOutcome)
    assert call_count == 90
    assert outcome.total_runs == 90
    assert outcome.summary["speech_end->tts_first_audio"]["p95_ms"] <= 480
    assert outcome.pass_fail["time_to_first_audio_p50_pass"] is True
    assert outcome.pass_fail["time_to_first_audio_p95_pass"] is True
    assert outcome.pass_fail["speech_end_to_stt_final_p95_pass"] is True
    assert len(outcome.raw_event_logs) == 90
