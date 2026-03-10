from __future__ import annotations

from typing import TypedDict


class SessionSnapshot(TypedDict):
    grade_band: str
    history: list[dict[str, str]]
    student_profile: dict[str, str]
    subject: str


_SESSION_REGISTRY: dict[str, SessionSnapshot] = {}


def load_session_snapshot(session_id: str) -> SessionSnapshot | None:
    snapshot = _SESSION_REGISTRY.get(session_id)
    if snapshot is None:
        return None

    return {
        "grade_band": snapshot["grade_band"],
        "history": [dict(item) for item in snapshot["history"]],
        "student_profile": dict(snapshot["student_profile"]),
        "subject": snapshot["subject"],
    }


def save_session_snapshot(session_id: str, snapshot: SessionSnapshot) -> None:
    _SESSION_REGISTRY[session_id] = {
        "grade_band": snapshot["grade_band"],
        "history": [dict(item) for item in snapshot["history"]],
        "student_profile": dict(snapshot["student_profile"]),
        "subject": snapshot["subject"],
    }


def clear_session_snapshot(session_id: str) -> None:
    _SESSION_REGISTRY.pop(session_id, None)
