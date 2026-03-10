from __future__ import annotations

from backend.monitoring.latency_tracker import LatencyTracker
from backend.turn_taking.state import SessionState


class SessionController:
    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self.state = SessionState.IDLE
        self.latency_tracker = LatencyTracker()
        self.subject = "general"
        self.grade_band = "6-8"
        self.history: list[dict[str, str]] = []
        self.student_profile: dict[str, str] = {}

    def open_session(self) -> list[dict[str, object]]:
        return [
            {
                "type": "session.started",
                "session_id": self.session_id,
                "state": self.state.value,
            }
        ]

    def handle_audio_chunk(self, sequence: int, size: int) -> list[dict[str, object]]:
        if self.state is SessionState.IDLE:
            self.state = SessionState.LISTENING
            return [
                {"type": "state.changed", "state": self.state.value},
                {"type": "audio.received", "sequence": sequence, "size": size},
            ]
        return [{"type": "audio.received", "sequence": sequence, "size": size}]

    def handle_speech_end(self, ts_ms: float) -> list[dict[str, object]]:
        self.latency_tracker.mark("speech_end", ts_ms)
        self.state = SessionState.THINKING
        return [{"type": "state.changed", "state": self.state.value}]

    def begin_tutor_turn(self, turn_id: str) -> list[dict[str, object]]:
        self.state = SessionState.SPEAKING
        return [
            {"type": "state.changed", "state": self.state.value},
            {"type": "tutor.turn.started", "turn_id": turn_id},
        ]

    def complete_tutor_turn(self, turn_id: str) -> list[dict[str, object]]:
        self.state = SessionState.IDLE
        return [
            {"type": "tutor.turn.completed", "turn_id": turn_id},
            {"type": "state.changed", "state": self.state.value},
        ]

    def interrupt(self) -> list[dict[str, object]]:
        self.state = SessionState.FADING
        events = [{"type": "state.changed", "state": self.state.value}]
        self.state = SessionState.IDLE
        events.append({"type": "state.changed", "state": self.state.value})
        return events
