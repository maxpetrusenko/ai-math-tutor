from __future__ import annotations

from backend.session.turn_trace import write_turn_trace


def test_write_turn_trace_keeps_user_controlled_ids_inside_trace_dir(monkeypatch, tmp_path) -> None:
    trace_dir = tmp_path / "turn-traces"
    monkeypatch.setenv("NERDY_TURN_TRACE_DIR", str(trace_dir))

    path = write_turn_trace(
        {
            "session_id": "../escape/session",
            "turn_id": "../../turn:name",
            "latency": {"events": []},
        }
    )

    assert path.parent == trace_dir
    assert path.resolve().parent == trace_dir.resolve()
    assert path.name == "escape-session-turn-name.json"

    outside_trace_files = [candidate for candidate in tmp_path.rglob("*.json") if trace_dir not in candidate.parents]
    assert outside_trace_files == []


def test_write_turn_trace_bounds_user_controlled_filename_components(monkeypatch, tmp_path) -> None:
    trace_dir = tmp_path / "turn-traces"
    monkeypatch.setenv("NERDY_TURN_TRACE_DIR", str(trace_dir))

    path = write_turn_trace(
        {
            "session_id": "s" * 300,
            "turn_id": "t" * 300,
            "latency": {"events": []},
        }
    )

    assert path.parent == trace_dir
    assert path.name.endswith(".json")
    assert len(path.name.encode()) <= 255
