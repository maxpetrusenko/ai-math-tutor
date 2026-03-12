from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from backend.monitoring.latency_tracker import LatencyTracker

DEFAULT_TURN_TRACE_DIR = ".nerdy-data/turn-traces"


def trace_path(session_id: str, turn_id: str) -> Path:
    trace_dir = Path(os.getenv("NERDY_TURN_TRACE_DIR", DEFAULT_TURN_TRACE_DIR))
    trace_dir.mkdir(parents=True, exist_ok=True)
    return trace_dir / f"{session_id}-{turn_id}.json"


def write_turn_trace(payload: dict[str, Any]) -> Path:
    session_id = str(payload.get("session_id") or "session")
    turn_id = str(payload.get("turn_id") or "turn")
    path = trace_path(session_id, turn_id)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str) + "\n")
    return path


def append_latency_trace_event(
    *,
    session_id: str,
    turn_id: str,
    event_name: str,
    ts_ms: float,
    metadata: dict[str, Any] | None = None,
) -> Path | None:
    path = trace_path(session_id, turn_id)
    if not path.exists():
        return None

    payload = json.loads(path.read_text())
    latency_payload = payload.setdefault("latency", {})
    events_payload = list(latency_payload.get("events") or [])
    filtered_events = [
        event
        for event in events_payload
        if isinstance(event, dict) and str(event.get("name") or "") != event_name
    ]
    filtered_events.append(
        {
            "name": event_name,
            "ts_ms": ts_ms,
            "metadata": metadata or {},
        }
    )

    tracker = LatencyTracker()
    for event in filtered_events:
        if not isinstance(event, dict):
            continue
        tracker.mark(
            str(event.get("name") or ""),
            float(event.get("ts_ms") or 0.0),
            dict(event.get("metadata") or {}),
        )

    payload["latency"] = summarize_latency_tracker(tracker)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str) + "\n")
    return path


def summarize_latency_tracker(tracker: LatencyTracker) -> dict[str, object]:
    return {
        "events": [
            {
                "name": event.name,
                "ts_ms": event.ts_ms,
                "metadata": event.metadata,
            }
            for event in tracker.events
        ],
        "stage_durations": tracker.stage_durations(),
    }
