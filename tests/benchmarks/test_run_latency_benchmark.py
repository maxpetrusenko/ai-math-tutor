from __future__ import annotations

import json
import os
import types

from backend.benchmarks.run_latency_benchmark import (
    BenchmarkOutcome,
    compare_benchmark_outcomes,
    load_canned_prompts,
    load_local_env,
    main,
    run_benchmark,
    run_benchmark_from_event_logs,
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
    assert outcome.mode == "fixture"
    assert call_count == 90
    assert outcome.total_runs == 90
    assert outcome.summary["speech_end->tts_first_audio"]["p95_ms"] <= 480
    assert outcome.pass_fail["time_to_first_audio_p50_pass"] is True
    assert outcome.pass_fail["time_to_first_audio_p95_pass"] is True
    assert outcome.pass_fail["speech_end_to_stt_final_p95_pass"] is True
    assert outcome.pass_fail["required_event_set_pass"] is False
    assert outcome.required_event_coverage["missing_event_counts"]["first_viseme"] == 90
    assert len(outcome.raw_event_logs) == 90


def test_run_benchmark_marks_required_event_pass_when_all_required_events_exist() -> None:
    def fake_pipeline(prompt_id: str, iteration: int) -> LatencyTracker:
        del prompt_id, iteration
        tracker = LatencyTracker()
        tracker.mark("speech_end", 0)
        tracker.mark("stt_partial_stable", 40)
        tracker.mark("stt_final", 80)
        tracker.mark("llm_first_token", 140)
        tracker.mark("tts_first_audio", 220)
        tracker.mark("first_viseme", 260)
        tracker.mark("audio_done", 520)
        return tracker

    outcome = run_benchmark(
        "backend/benchmarks/canned_prompts.json",
        pipeline=fake_pipeline,
        runs_per_prompt=1,
        mode="live",
    )

    assert outcome.mode == "live"
    assert outcome.pass_fail["required_event_set_pass"] is True
    assert outcome.required_event_coverage["complete_runs"] == 3
    assert outcome.summary["tts_first_audio->first_viseme"]["p50_ms"] == 40
    assert outcome.summary["speech_end->audio_done"]["p95_ms"] == 520


def test_run_benchmark_from_event_logs_aggregates_live_runs(tmp_path) -> None:
    event_log_path = tmp_path / "live-runs.json"
    event_log_path.write_text(
        json.dumps(
            {
                "runs": [
                    {
                        "prompt_id": "solve-for-x",
                        "iteration": 0,
                        "events": [
                            {"name": "speech_end", "ts_ms": 0},
                            {"name": "stt_partial_stable", "ts_ms": 55},
                            {"name": "stt_final", "ts_ms": 110},
                            {"name": "llm_first_token", "ts_ms": 190},
                            {"name": "tts_first_audio", "ts_ms": 320},
                            {"name": "first_viseme", "ts_ms": 360},
                            {"name": "audio_done", "ts_ms": 980},
                        ],
                    },
                    {
                        "prompt_id": "solve-for-x",
                        "iteration": 1,
                        "events": [
                            {"name": "speech_end", "ts_ms": 0},
                            {"name": "stt_partial_stable", "ts_ms": 60},
                            {"name": "stt_final", "ts_ms": 120},
                            {"name": "llm_first_token", "ts_ms": 210},
                            {"name": "tts_first_audio", "ts_ms": 350},
                            {"name": "first_viseme", "ts_ms": 390},
                            {"name": "audio_done", "ts_ms": 1020},
                        ],
                    },
                ]
            }
        )
    )

    outcome = run_benchmark_from_event_logs(str(event_log_path))

    assert outcome.mode == "live"
    assert outcome.total_runs == 2
    assert outcome.pass_fail["required_event_set_pass"] is True
    assert outcome.summary["speech_end->tts_first_audio"]["p50_ms"] == 335


def test_compare_benchmark_outcomes_builds_fixture_vs_live_delta_table() -> None:
    def fixture_pipeline(prompt_id: str, iteration: int) -> LatencyTracker:
        del prompt_id, iteration
        tracker = LatencyTracker()
        tracker.mark("speech_end", 0)
        tracker.mark("stt_partial_stable", 40)
        tracker.mark("stt_final", 80)
        tracker.mark("llm_first_token", 140)
        tracker.mark("tts_first_audio", 220)
        tracker.mark("first_viseme", 250)
        tracker.mark("audio_done", 480)
        return tracker

    def live_pipeline(prompt_id: str, iteration: int) -> LatencyTracker:
        del prompt_id, iteration
        tracker = LatencyTracker()
        tracker.mark("speech_end", 0)
        tracker.mark("stt_partial_stable", 70)
        tracker.mark("stt_final", 130)
        tracker.mark("llm_first_token", 230)
        tracker.mark("tts_first_audio", 390)
        tracker.mark("first_viseme", 450)
        tracker.mark("audio_done", 1180)
        return tracker

    fixture = run_benchmark("backend/benchmarks/canned_prompts.json", fixture_pipeline, runs_per_prompt=1)
    live = run_benchmark("backend/benchmarks/canned_prompts.json", live_pipeline, runs_per_prompt=1, mode="live")

    comparison = compare_benchmark_outcomes(fixture, live)
    speech_to_audio_row = next(row for row in comparison if row["stage"] == "speech_end->tts_first_audio")

    assert speech_to_audio_row["fixture_p50_ms"] == 220.0
    assert speech_to_audio_row["live_p50_ms"] == 390.0
    assert speech_to_audio_row["p50_delta_ms"] == 170.0


def test_benchmark_main_writes_fixture_output(tmp_path) -> None:
    output_path = tmp_path / "fixture-benchmark.json"

    exit_code = main(["--mode", "fixture", "--runs-per-prompt", "1", "--output", str(output_path)])

    payload = json.loads(output_path.read_text())
    assert exit_code == 0
    assert payload["mode"] == "fixture"
    assert payload["total_runs"] == 3


def test_benchmark_main_writes_runtime_output(tmp_path, monkeypatch) -> None:
    output_path = tmp_path / "runtime-benchmark.json"

    fake_outcome = BenchmarkOutcome(
        mode="runtime",
        total_runs=3,
        raw_event_logs=[],
        summary={"speech_end->tts_first_audio": {"count": 3, "min_ms": 200, "max_ms": 240, "p50_ms": 220, "p95_ms": 238, "failure_count": 0}},
        pass_fail={
            "time_to_first_audio_p50_pass": True,
            "time_to_first_audio_p95_pass": True,
            "speech_end_to_stt_final_p95_pass": True,
            "required_event_set_pass": True,
        },
        required_event_coverage={
            "required_events": [],
            "complete_runs": 3,
            "total_runs": 3,
            "missing_event_counts": {},
            "missing_runs": [],
        },
    )
    runtime_module = types.SimpleNamespace(run_runtime_fast_benchmark=lambda path, runs_per_prompt=1: fake_outcome)
    monkeypatch.setitem(__import__("sys").modules, "backend.benchmarks.runtime_fast_benchmark", runtime_module)

    exit_code = main(["--mode", "runtime", "--runs-per-prompt", "1", "--output", str(output_path)])

    payload = json.loads(output_path.read_text())
    assert exit_code == 0
    assert payload["mode"] == "runtime"
    assert payload["total_runs"] == 3


def test_load_local_env_reads_repo_env_files(tmp_path, monkeypatch) -> None:
    repo_root = tmp_path / "repo"
    frontend_dir = repo_root / "frontend"
    frontend_dir.mkdir(parents=True)
    (repo_root / ".env").write_text("DEEPGRAM_API_KEY=deepgram-test\nEMPTY_VALUE=\n")
    (frontend_dir / ".env.local").write_text("MINIMAX_API_KEY=minimax-test\n")

    monkeypatch.setattr("backend.benchmarks.run_latency_benchmark.REPO_ROOT", repo_root)
    monkeypatch.delenv("DEEPGRAM_API_KEY", raising=False)
    monkeypatch.delenv("MINIMAX_API_KEY", raising=False)
    monkeypatch.delenv("MINIMAX_SPEECH_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_AI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    loaded_paths = load_local_env()

    assert str(repo_root / ".env") in loaded_paths
    assert str(frontend_dir / ".env.local") in loaded_paths
    assert os.environ["DEEPGRAM_API_KEY"] == "deepgram-test"
    assert os.environ["MINIMAX_API_KEY"] == "minimax-test"
    assert os.environ["MINIMAX_SPEECH_API_KEY"] == "minimax-test"


def test_load_local_env_maps_google_ai_key_to_gemini_key(tmp_path, monkeypatch) -> None:
    repo_root = tmp_path / "repo"
    repo_root.mkdir()
    (repo_root / ".env").write_text("GOOGLE_AI_API_KEY=google-test\n")

    monkeypatch.setattr("backend.benchmarks.run_latency_benchmark.REPO_ROOT", repo_root)
    monkeypatch.delenv("GOOGLE_AI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    load_local_env()

    assert os.environ["GOOGLE_AI_API_KEY"] == "google-test"
    assert os.environ["GEMINI_API_KEY"] == "google-test"
