from __future__ import annotations

from dataclasses import dataclass, field
from math import floor
from typing import Any

REQUIRED_EVENT_NAMES = [
    "speech_end",
    "stt_partial_stable",
    "stt_final",
    "llm_first_token",
    "tts_first_audio",
    "first_viseme",
    "audio_done",
]

_FAILURE_THRESHOLDS_MS = {
    "speech_end->stt_final": 350,
    "speech_end->tts_first_audio": 900,
}


@dataclass(slots=True)
class LatencyEvent:
    name: str
    ts_ms: float
    metadata: dict[str, Any] = field(default_factory=dict)


class LatencyTracker:
    def __init__(self) -> None:
        self.events: list[LatencyEvent] = []

    def mark(self, event_name: str, ts_ms: float, metadata: dict[str, Any] | None = None) -> None:
        if event_name not in REQUIRED_EVENT_NAMES:
            raise ValueError(f"unknown event: {event_name}")
        self.events.append(LatencyEvent(event_name, ts_ms, metadata or {}))

    def stage_durations(self) -> dict[str, float]:
        index = {event.name: event.ts_ms for event in self.events}
        durations: dict[str, float] = {}
        _add_duration(durations, index, "speech_end", "stt_partial_stable")
        _add_duration(durations, index, "speech_end", "stt_final")
        _add_duration(durations, index, "stt_final", "llm_first_token")
        _add_duration(durations, index, "llm_first_token", "tts_first_audio")
        _add_duration(durations, index, "tts_first_audio", "first_viseme")
        _add_duration(durations, index, "speech_end", "tts_first_audio")
        _add_duration(durations, index, "speech_end", "first_viseme")
        _add_duration(durations, index, "speech_end", "audio_done")
        return durations


def aggregate_stage_metrics(trackers: list[LatencyTracker]) -> dict[str, dict[str, float | int]]:
    stage_values: dict[str, list[float]] = {}

    for tracker in trackers:
        for stage_name, duration in tracker.stage_durations().items():
            stage_values.setdefault(stage_name, []).append(duration)

    summary: dict[str, dict[str, float | int]] = {}
    for stage_name, values in stage_values.items():
        ordered = sorted(values)
        threshold = _FAILURE_THRESHOLDS_MS.get(stage_name)
        summary[stage_name] = {
            "count": len(ordered),
            "min_ms": ordered[0],
            "max_ms": ordered[-1],
            "p50_ms": _percentile_linear(ordered, 0.50),
            "p95_ms": _percentile_linear(ordered, 0.95),
            "failure_count": sum(1 for value in ordered if threshold is not None and value > threshold),
        }
    return summary


def _add_duration(durations: dict[str, float], index: dict[str, float], start: str, end: str) -> None:
    if start in index and end in index:
        durations[f"{start}->{end}"] = index[end] - index[start]


def _percentile_linear(values: list[float], ratio: float) -> float:
    if len(values) == 1:
        return values[0]

    position = (len(values) - 1) * ratio
    lower_index = floor(position)
    upper_index = min(lower_index + 1, len(values) - 1)
    lower_value = values[lower_index]
    upper_value = values[upper_index]
    weight = position - lower_index
    return lower_value + (upper_value - lower_value) * weight
