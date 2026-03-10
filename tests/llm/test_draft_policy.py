from backend.llm.draft_policy import build_draft_tutor_reply
from eval.socratic_checks import score_tutor_turn


def test_build_draft_tutor_reply_hits_benchmark_quality_bar() -> None:
    cases = [
        ("math", "6-8", "I don't understand how to solve for x.", "linear equations"),
        ("science", "9-10", "What about photosynthesis?", "photosynthesis basics"),
        ("english", "11-12", "Is it 5?", "subject-verb agreement"),
    ]

    for subject, grade_band, student_text, expected_concept in cases:
        reply = build_draft_tutor_reply(
            subject=subject,
            grade_band=grade_band,
            latest_student_text=student_text,
        )
        scores = score_tutor_turn(
            tutor_text=reply,
            expected_concept=expected_concept,
            grade_band=grade_band,
        )

        assert scores["Socratic questioning"] >= 4
        assert scores["Correctness"] >= 4
        assert scores["Direct-answer avoidance"] == 5


def test_build_draft_tutor_reply_uses_concrete_example_for_math_truth_check() -> None:
    reply = build_draft_tutor_reply(
        subject="math",
        grade_band="6-8",
        latest_student_text="2+2=4 is it true?",
        student_profile={"preference": "Slow down, use concrete examples..."},
    )

    assert "what do you notice about 2+2=4 is it true" not in reply.lower()
    assert "2 blocks" in reply.lower()
    assert reply.endswith("?")
