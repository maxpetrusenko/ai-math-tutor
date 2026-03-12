from backend.session.persistence import archive_lesson_thread, load_archived_lesson_thread, write_active_lesson_thread


def test_lesson_state_survives_active_and_archived_persistence(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))

    thread = {
        "avatarProviderId": "sage-svg-2d",
        "conversation": [{"id": "1", "transcript": "lets learn fractions", "tutorText": "start here"}],
        "gradeBand": "3-5",
        "lessonState": {
            "currentStepIndex": 1,
            "currentTask": "Convert each fraction to twelfths",
            "lessonId": 3,
            "lessonTitle": "Intro to Fractions",
            "nextQuestion": "How do we rewrite 1/4 as a fraction with denominator 12?",
            "program": [
                "Understand what the fractions represent",
                "Add fractions with unlike denominators",
                "Check the answer with one more example",
            ],
            "startedFromCatalog": True,
        },
        "llmModel": "gpt-realtime-mini",
        "llmProvider": "openai-realtime",
        "preference": "",
        "sessionId": "lesson-progress-py",
        "studentPrompt": "lets learn fractions",
        "subject": "math",
        "ttsModel": "gpt-realtime-mini",
        "ttsProvider": "openai-realtime",
        "transcript": "lets learn fractions",
        "tutorText": "start here",
        "version": 1,
    }

    lesson_store = write_active_lesson_thread(thread)
    assert lesson_store["activeThread"]["lessonState"]["lessonTitle"] == "Intro to Fractions"

    archive_lesson_thread(
        {
            "gradeBand": "3-5",
            "id": "archive-1",
            "subject": "math",
            "thread": thread,
            "title": "Intro to Fractions",
            "turnCount": 1,
            "updatedAt": "2026-03-11T00:00:00Z",
        }
    )

    archived = load_archived_lesson_thread("archive-1")
    assert archived is not None
    assert archived["lessonState"]["nextQuestion"] == "How do we rewrite 1/4 as a fraction with denominator 12?"
