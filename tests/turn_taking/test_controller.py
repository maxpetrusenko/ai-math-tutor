from backend.turn_taking.controller import SessionController
from backend.turn_taking.state import SessionState


def test_controller_owns_turn_state_transitions() -> None:
    controller = SessionController(session_id="session-1")

    started = controller.open_session()
    listening = controller.handle_audio_chunk(sequence=1, size=320)
    thinking = controller.handle_speech_end(ts_ms=1000)
    speaking = controller.begin_tutor_turn(turn_id="turn-1")
    interrupted = controller.interrupt()

    assert controller.state is SessionState.IDLE
    assert started[0]["type"] == "session.started"
    assert listening[0]["state"] == "listening"
    assert thinking[0]["state"] == "thinking"
    assert speaking[0]["state"] == "speaking"
    assert interrupted[0]["state"] == "fading"
    assert interrupted[-1]["state"] == "idle"


def test_controller_records_speech_end_event() -> None:
    controller = SessionController(session_id="session-2")
    controller.open_session()
    controller.handle_audio_chunk(sequence=1, size=320)
    controller.handle_speech_end(ts_ms=1234)

    durations = controller.latency_tracker.stage_durations()

    assert controller.latency_tracker.events[0].name == "speech_end"
    assert controller.state is SessionState.THINKING
    assert durations == {}
