from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Callable

from backend.monitoring.latency_tracker import LatencyTracker, aggregate_stage_metrics


@dataclass(frozen=True, slots=True)
class BenchmarkPrompt:
    id: str
    subject: str
    grade_band: str
    student_transcript: str
    tags: list[str]


@dataclass(frozen=True, slots=True)
class BenchmarkOutcome:
    total_runs: int
    raw_event_logs: list[dict[str, object]]
    summary: dict[str, dict[str, float | int]]
    pass_fail: dict[str, bool]


PipelineFn = Callable[[str, int], LatencyTracker]


def load_canned_prompts(path: str) -> list[BenchmarkPrompt]:
    payload = json.loads(Path(path).read_text())
    return [BenchmarkPrompt(**prompt) for prompt in payload["prompts"]]


def run_benchmark(path: str, pipeline: PipelineFn, runs_per_prompt: int = 30) -> BenchmarkOutcome:
    prompts = load_canned_prompts(path)
    trackers: list[LatencyTracker] = []
    raw_event_logs: list[dict[str, object]] = []

    for prompt in prompts:
        for iteration in range(runs_per_prompt):
            tracker = pipeline(prompt.id, iteration)
            trackers.append(tracker)
            raw_event_logs.append(
                {
                    "prompt_id": prompt.id,
                    "iteration": iteration,
                    "events": [
                        {
                            "name": event.name,
                            "ts_ms": event.ts_ms,
                            "metadata": event.metadata,
                        }
                        for event in tracker.events
                    ],
                }
            )

    summary = aggregate_stage_metrics(trackers)
    time_to_first_audio = summary["speech_end->tts_first_audio"]
    speech_to_stt_final = summary["speech_end->stt_final"]
    pass_fail = {
        "time_to_first_audio_p50_pass": float(time_to_first_audio["p50_ms"]) <= 500,
        "time_to_first_audio_p95_pass": float(time_to_first_audio["p95_ms"]) <= 900,
        "speech_end_to_stt_final_p95_pass": float(speech_to_stt_final["p95_ms"]) <= 350,
    }

    return BenchmarkOutcome(
        total_runs=len(trackers),
        raw_event_logs=raw_event_logs,
        summary=summary,
        pass_fail=pass_fail,
    )
