from backend.llm.prompt_builder import build_tutor_messages


def test_build_tutor_messages_includes_grade_subject_and_history() -> None:
    messages = build_tutor_messages(
        subject="math",
        grade_band="6-8",
        latest_student_text="I don't understand how to solve for x.",
        history=[
            {"role": "assistant", "content": "What does the equation look like?"},
            {"role": "user", "content": "2x + 5 = 15"},
        ],
    )

    assert messages[0]["role"] == "system"
    assert "grades 6-8" in messages[0]["content"]
    assert "subject: math" in messages[0]["content"].lower()
    assert messages[-1]["content"] == "I don't understand how to solve for x."
    assert len(messages) == 4


def test_build_tutor_messages_includes_student_preferences() -> None:
    messages = build_tutor_messages(
        subject="science",
        grade_band="9-10",
        latest_student_text="What about photosynthesis?",
        history=[],
        student_profile={"pacing": "slow", "preference": "use concrete examples"},
    )

    assert "pacing: slow" in messages[0]["content"].lower()
    assert "use concrete examples" in messages[0]["content"].lower()
