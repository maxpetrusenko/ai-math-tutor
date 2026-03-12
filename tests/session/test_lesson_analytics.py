from backend.session.learning_analytics import summarize_learning_analytics


def test_learning_analytics_summarizes_active_and_archived_lessons() -> None:
    summary = summarize_learning_analytics(
        active_thread={
            "avatarProviderId": "sage-svg-2d",
            "conversation": [
                {"id": "active-1", "transcript": "Help with fractions", "tutorText": "Start here"},
                {"id": "active-2", "transcript": "I think it is 3/12", "tutorText": "Check that step"},
            ],
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
            "sessionId": "active-lesson",
            "studentPrompt": "",
            "subject": "math",
            "transcript": "",
            "ttsModel": "gpt-realtime-mini",
            "ttsProvider": "openai-realtime",
            "tutorText": "",
            "version": 1,
        },
        archived_lessons=[
            {
                "gradeBand": "6-8",
                "id": "archive-1",
                "subject": "math",
                "thread": {
                    "avatarProviderId": "sage-svg-2d",
                    "conversation": [],
                    "gradeBand": "6-8",
                    "lessonState": {
                        "currentStepIndex": 2,
                        "currentTask": "Solve one-step linear equations",
                        "lessonId": 6,
                        "lessonTitle": "Linear Equations",
                        "nextQuestion": "What do you do first to solve x + 5 = 12?",
                        "program": [
                            "Identify the variable",
                            "Undo operations step by step",
                            "Check the solution",
                        ],
                        "startedFromCatalog": True,
                    },
                    "llmModel": "gpt-realtime-mini",
                    "llmProvider": "openai-realtime",
                    "preference": "",
                    "sessionId": "archived-lesson",
                    "studentPrompt": "",
                    "subject": "math",
                    "transcript": "",
                    "ttsModel": "gpt-realtime-mini",
                    "ttsProvider": "openai-realtime",
                    "tutorText": "",
                    "version": 1,
                },
                "title": "Linear Equations",
                "turnCount": 3,
                "updatedAt": "2026-03-11T00:00:00Z",
            }
        ],
        now_iso="2026-03-12T12:00:00Z",
    )

    assert summary["completedLessons"] == 1
    assert summary["practiceDays"] == 2
    assert summary["currentStreakDays"] == 2
    assert summary["estimatedMinutes"] == 15
    assert summary["masteryScore"] == 84
    assert summary["strongestSubject"] == "Math"
    assert summary["recentLessonTitles"] == ["Linear Equations"]
    assert summary["tutorTurns"] == 5
    assert [item["label"] for item in summary["achievements"]] == [
        "2-day streak",
        "Mastery climbing",
        "Deep practice",
    ]
