from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
import json
import os
from pathlib import Path
from typing import Callable, Literal

from backend.monitoring.latency_tracker import (
    REQUIRED_EVENT_NAMES,
    LatencyTracker,
    aggregate_stage_metrics,
)


@dataclass(frozen=True, slots=True)
class BenchmarkPrompt:
    id: str
    subject: str
    grade_band: str
    student_transcript: str
    tags: list[str]


@dataclass(frozen=True, slots=True)
class BenchmarkOutcome:
    mode: str
    total_runs: int
    raw_event_logs: list[dict[str, object]]
    summary: dict[str, dict[str, float | int]]
    pass_fail: dict[str, bool]
    required_event_coverage: dict[str, object]


PipelineFn = Callable[[str, int], LatencyTracker]
BenchmarkMode = Literal["fixture", "live"]
REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_ALIASES = {
    "GEMINI_API_KEY": "GOOGLE_AI_API_KEY",
    "MINIMAX_SPEECH_API_KEY": "MINIMAX_API_KEY",
}


def load_canned_prompts(path: str) -> list[BenchmarkPrompt]:
    payload = json.loads(Path(path).read_text())
    return [BenchmarkPrompt(**prompt) for prompt in payload["prompts"]]


def run_benchmark(
    path: str,
    pipeline: PipelineFn,
    runs_per_prompt: int = 30,
    *,
    mode: BenchmarkMode = "fixture",
) -> BenchmarkOutcome:
    prompts = load_canned_prompts(path)
    trackers: list[LatencyTracker] = []
    raw_event_logs: list[dict[str, object]] = []

    for prompt in prompts:
        for iteration in range(runs_per_prompt):
            tracker = pipeline(prompt.id, iteration)
            trackers.append(tracker)
            raw_event_logs.append(
                {
                    "mode": mode,
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

    return build_benchmark_outcome(mode=mode, trackers=trackers, raw_event_logs=raw_event_logs)


def run_benchmark_from_event_logs(
    path: str,
    *,
    mode: BenchmarkMode = "live",
) -> BenchmarkOutcome:
    payload = json.loads(Path(path).read_text())
    runs = payload["runs"] if isinstance(payload, dict) else payload
    trackers: list[LatencyTracker] = []
    raw_event_logs: list[dict[str, object]] = []

    for index, run in enumerate(runs):
        tracker = LatencyTracker()
        events_payload = run["events"]
        events: list[dict[str, object]] = []
        for event in events_payload:
            normalized_event = {
                "name": str(event["name"]),
                "ts_ms": float(event["ts_ms"]),
                "metadata": dict(event.get("metadata") or {}),
            }
            tracker.mark(
                normalized_event["name"],
                normalized_event["ts_ms"],
                normalized_event["metadata"],
            )
            events.append(normalized_event)

        trackers.append(tracker)
        raw_event_logs.append(
            {
                "mode": mode,
                "prompt_id": str(run.get("prompt_id", f"run-{index + 1}")),
                "iteration": int(run.get("iteration", index)),
                "events": events,
            }
        )

    return build_benchmark_outcome(mode=mode, trackers=trackers, raw_event_logs=raw_event_logs)


def compare_benchmark_outcomes(
    fixture_outcome: BenchmarkOutcome,
    live_outcome: BenchmarkOutcome,
) -> list[dict[str, float | str | None]]:
    stage_names = sorted(set(fixture_outcome.summary) | set(live_outcome.summary))
    comparison: list[dict[str, float | str | None]] = []

    for stage_name in stage_names:
        fixture_stage = fixture_outcome.summary.get(stage_name)
        live_stage = live_outcome.summary.get(stage_name)
        fixture_p50 = _metric_value(fixture_stage, "p50_ms")
        live_p50 = _metric_value(live_stage, "p50_ms")
        fixture_p95 = _metric_value(fixture_stage, "p95_ms")
        live_p95 = _metric_value(live_stage, "p95_ms")
        comparison.append(
            {
                "stage": stage_name,
                "fixture_p50_ms": fixture_p50,
                "live_p50_ms": live_p50,
                "fixture_p95_ms": fixture_p95,
                "live_p95_ms": live_p95,
                "p50_delta_ms": _delta(live_p50, fixture_p50),
                "p95_delta_ms": _delta(live_p95, fixture_p95),
            }
        )

    return comparison


def build_benchmark_outcome(
    *,
    mode: BenchmarkMode,
    trackers: list[LatencyTracker],
    raw_event_logs: list[dict[str, object]],
) -> BenchmarkOutcome:
    summary = aggregate_stage_metrics(trackers)
    time_to_first_audio = summary.get("speech_end->tts_first_audio")
    speech_to_stt_final = summary.get("speech_end->stt_final")
    required_event_coverage = summarize_required_event_coverage(raw_event_logs)
    pass_fail = {
        "time_to_first_audio_p50_pass": _metric_pass(time_to_first_audio, "p50_ms", 500),
        "time_to_first_audio_p95_pass": _metric_pass(time_to_first_audio, "p95_ms", 900),
        "speech_end_to_stt_final_p95_pass": _metric_pass(speech_to_stt_final, "p95_ms", 350),
        "required_event_set_pass": not bool(required_event_coverage["missing_runs"]),
    }

    return BenchmarkOutcome(
        mode=mode,
        total_runs=len(trackers),
        raw_event_logs=raw_event_logs,
        summary=summary,
        pass_fail=pass_fail,
        required_event_coverage=required_event_coverage,
    )


def summarize_required_event_coverage(raw_event_logs: list[dict[str, object]]) -> dict[str, object]:
    missing_event_counts = {event_name: 0 for event_name in REQUIRED_EVENT_NAMES}
    missing_runs: list[dict[str, object]] = []

    for run in raw_event_logs:
        event_names = {
            str(event["name"])
            for event in run["events"]
            if isinstance(event, dict) and "name" in event
        }
        missing_events = [event_name for event_name in REQUIRED_EVENT_NAMES if event_name not in event_names]
        for event_name in missing_events:
            missing_event_counts[event_name] += 1
        if missing_events:
            missing_runs.append(
                {
                    "prompt_id": run["prompt_id"],
                    "iteration": run["iteration"],
                    "missing_events": missing_events,
                }
            )

    return {
        "required_events": list(REQUIRED_EVENT_NAMES),
        "complete_runs": len(raw_event_logs) - len(missing_runs),
        "total_runs": len(raw_event_logs),
        "missing_event_counts": missing_event_counts,
        "missing_runs": missing_runs,
    }


def _metric_pass(
    stage: dict[str, float | int] | None,
    key: str,
    threshold: float,
) -> bool:
    if stage is None:
        return False
    return float(stage[key]) <= threshold


def _metric_value(stage: dict[str, float | int] | None, key: str) -> float | None:
    if stage is None:
        return None
    return float(stage[key])


def _delta(left: float | None, right: float | None) -> float | None:
    if left is None or right is None:
        return None
    return left - right


def _fixture_pipeline(prompt_id: str, iteration: int) -> LatencyTracker:
    prompt_offset = len(prompt_id) % 7
    tracker = LatencyTracker()
    tracker.mark("speech_end", 0)
    tracker.mark("stt_partial_stable", 65 + prompt_offset + (iteration % 2) * 5)
    tracker.mark("stt_final", 110 + prompt_offset + (iteration % 3) * 10)
    tracker.mark("llm_first_token", 185 + prompt_offset + (iteration % 2) * 15)
    tracker.mark("tts_first_audio", 430 + prompt_offset + (iteration % 4) * 20)
    tracker.mark("first_viseme", 470 + prompt_offset + (iteration % 3) * 15)
    tracker.mark("audio_done", 1180 + prompt_offset + (iteration % 5) * 30)
    return tracker


def load_local_env() -> list[str]:
    loaded_paths: list[str] = []

    for path in (
        REPO_ROOT / ".env",
        REPO_ROOT / ".env.local",
        REPO_ROOT / "frontend/.env.local",
    ):
        if _load_env_file(path):
            loaded_paths.append(str(path))

    _apply_env_aliases()
    return loaded_paths


def _load_env_file(path: Path) -> bool:
    if not path.exists():
        return False

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        key, raw_value = line.split("=", 1)
        key = key.strip()
        value = raw_value.strip().strip("'").strip('"')
        if key:
            os.environ.setdefault(key, value)

    return True


def _apply_env_aliases() -> None:
    for target_key, source_key in ENV_ALIASES.items():
        if not os.getenv(target_key) and os.getenv(source_key):
            os.environ[target_key] = str(os.environ[source_key])


def main(argv: list[str] | None = None) -> int:
    load_local_env()
    parser = argparse.ArgumentParser(description="Run or analyze latency benchmarks.")
    parser.add_argument(
        "--mode",
        choices=("fixture", "live"),
        default="fixture",
        help="fixture runs the built-in deterministic harness; live analyzes recorded event logs.",
    )
    parser.add_argument(
        "--prompts",
        default="backend/benchmarks/canned_prompts.json",
        help="path to canned prompt fixture",
    )
    parser.add_argument("--runs-per-prompt", type=int, default=1, help="number of iterations per prompt")
    parser.add_argument(
        "--event-log",
        help="path to recorded benchmark runs JSON for live mode",
    )
    parser.add_argument(
        "--output",
        help="optional output path for JSON results",
    )
    args = parser.parse_args(argv)

    if args.mode == "live":
        if args.event_log:
            outcome = run_benchmark_from_event_logs(args.event_log, mode="live")
        else:
            from backend.benchmarks.live_provider_benchmark import run_live_provider_benchmark

            outcome = run_live_provider_benchmark(
                args.prompts,
                runs_per_prompt=args.runs_per_prompt,
            )
    else:
        outcome = run_benchmark(
            args.prompts,
            pipeline=_fixture_pipeline,
            runs_per_prompt=args.runs_per_prompt,
            mode="fixture",
        )

    payload = asdict(outcome)
    if args.output:
        Path(args.output).write_text(json.dumps(payload, indent=2))
    else:
        print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
