from backend.session.persistence import (
    archive_lesson_thread,
    load_archived_lesson_thread,
    read_lesson_store,
    write_active_lesson_thread,
)


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


def test_turn_debug_survives_active_and_archived_persistence(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))

    thread = {
        "avatarProviderId": "sage-svg-2d",
        "conversation": [
            {
                "debug": {
                    "audio": {
                        "chunkCount": 2,
                        "mimeTypes": ["audio/webm"],
                        "totalBytes": 640,
                        "withPayloadCount": 2,
                    },
                    "latency": {
                        "llmFirstTokenToTtsFirstAudioMs": 112,
                        "speechEndToSttFinalMs": 89,
                        "sttFinalToLlmFirstTokenMs": 44,
                    },
                    "request": {
                        "gradeBand": "6-8",
                        "llmModel": "gpt-realtime-mini",
                        "llmProvider": "openai-realtime",
                        "preference": "",
                        "source": "text",
                        "studentTextLength": 20,
                        "subject": "math",
                        "ttsModel": "gpt-realtime-mini",
                        "ttsProvider": "openai-realtime",
                    },
                    "response": {
                        "audioSegmentCount": 1,
                        "firstTimestampMs": 0,
                        "lastTimestampMs": 320,
                        "state": "speaking",
                        "timestampCount": 4,
                        "transcriptLength": 20,
                        "tutorTextLength": 36,
                    },
                    "sessionEvents": [
                        {
                            "event": "room.connected",
                            "id": "log-1",
                            "level": "info",
                            "scope": "managed-avatar",
                            "summary": "joined managed room",
                            "ts": "2026-03-12T16:00:00.000Z",
                        }
                    ],
                    "sessionId": "lesson-debug-py",
                    "startedAt": "2026-03-12T16:00:00.000Z",
                    "transport": "openai-realtime",
                },
                "id": "1",
                "transcript": "Custom lesson prompt",
                "tutorText": "What fraction is one slice?",
            }
        ],
        "gradeBand": "6-8",
        "lessonState": None,
        "llmModel": "gpt-realtime-mini",
        "llmProvider": "openai-realtime",
        "preference": "",
        "sessionId": "lesson-debug-py",
        "studentPrompt": "",
        "subject": "math",
        "ttsModel": "gpt-realtime-mini",
        "ttsProvider": "openai-realtime",
        "transcript": "Custom lesson prompt",
        "tutorText": "What fraction is one slice?",
        "version": 1,
    }

    lesson_store = write_active_lesson_thread(thread)
    active_debug = lesson_store["activeThread"]["conversation"][0]["debug"]
    assert active_debug["latency"]["speechEndToSttFinalMs"] == 89
    assert active_debug["sessionEvents"][0]["summary"] == "joined managed room"
    reloaded_store = read_lesson_store()
    reloaded_active_debug = reloaded_store["activeThread"]["conversation"][0]["debug"]
    assert reloaded_active_debug["latency"]["speechEndToSttFinalMs"] == 89
    assert reloaded_active_debug["sessionEvents"][0]["summary"] == "joined managed room"

    archive_lesson_thread(
        {
            "gradeBand": "6-8",
            "id": "archive-debug-1",
            "subject": "math",
            "thread": thread,
            "title": "Custom lesson prompt",
            "turnCount": 1,
            "updatedAt": "2026-03-12T16:00:00.000Z",
        }
    )

    archived = load_archived_lesson_thread("archive-debug-1")
    assert archived is not None
    archived_debug = archived["conversation"][0]["debug"]
    assert archived_debug["latency"]["speechEndToSttFinalMs"] == 89
    assert archived_debug["sessionEvents"][0]["summary"] == "joined managed room"
