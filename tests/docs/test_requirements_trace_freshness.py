from pathlib import Path


def test_docs_do_not_claim_browser_mic_is_missing_once_capture_exists() -> None:
    tutor_session_controller = Path("frontend/components/session/useTutorSessionController.ts").read_text()
    audio_capture = Path("frontend/lib/audio_capture.ts").read_text()
    requirements_trace = Path("docs/requirements-trace.md").read_text()
    testing_plan = Path("docs/testing-plan.md").read_text()

    assert "new BrowserAudioCapture()" in tutor_session_controller
    assert "navigator.mediaDevices?.getUserMedia" in audio_capture

    assert "Real browser mic capture is not implemented yet." not in requirements_trace
    assert "live mic capture path has no tests because the path does not exist yet" not in testing_plan


def test_docs_do_not_claim_latency_cards_are_placeholder_once_event_metrics_exist() -> None:
    tutor_session_controller = Path("frontend/components/session/useTutorSessionController.ts").read_text()
    tutor_session_actions = Path("frontend/components/session/tutor_session_actions.ts").read_text()
    session_socket = Path("frontend/lib/session_socket.ts").read_text()
    requirements_trace = Path("docs/requirements-trace.md").read_text()
    testing_plan = Path("docs/testing-plan.md").read_text()

    assert "createSessionMetrics()" in tutor_session_controller
    assert "createSessionMetrics()" in tutor_session_actions
    assert 'activeTurn.metrics.mark({ name: "stt_final"' in session_socket
    assert 'activeTurn.metrics.mark({ name: "llm_first_token"' in session_socket
    assert "toLatencyMetrics(activeTurn.metrics)" in session_socket

    assert "Frontend latency cards still need real timing, not placeholder numbers." not in requirements_trace
    assert "frontend latency cards still rely on placeholder data in the default flow" not in testing_plan
