from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from backend.monitoring.latency_tracker import LatencyTracker

DEFAULT_TURN_TRACE_DIR = ".nerdy-data/turn-traces"


def write_turn_trace(payload: dict[str, Any]) -> Path:
    trace_dir = Path(os.getenv("NERDY_TURN_TRACE_DIR", DEFAULT_TURN_TRACE_DIR))
    trace_dir.mkdir(parents=True, exist_ok=True)
    session_id = str(payload.get("session_id") or "session")
    turn_id = str(payload.get("turn_id") or "turn")
    path = trace_dir / f"{session_id}-{turn_id}.json"
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
