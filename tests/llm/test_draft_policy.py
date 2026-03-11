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


def test_build_draft_tutor_reply_uses_history_for_short_math_follow_up() -> None:
    reply = build_draft_tutor_reply(
        subject="math",
        grade_band="6-8",
        latest_student_text="4",
        history=[
            {"role": "user", "content": "2+2"},
            {"role": "assistant", "content": "Nice start. What part can you check first?"},
        ],
    )

    assert "that's right; 2+2 gives 4" in reply.lower()
    assert "what part can you check first" not in reply.lower()
    assert reply.endswith("?")


def test_build_draft_tutor_reply_treats_new_math_expression_as_fresh_problem() -> None:
    reply = build_draft_tutor_reply(
        subject="math",
        grade_band="6-8",
        latest_student_text="1+1",
        history=[
            {"role": "user", "content": "I don't understand how to solve for x."},
            {"role": "assistant", "content": "What equation are you working with?"},
        ],
    )

    assert "1+1" in reply
    assert "x" not in reply.lower()
    assert "what total" in reply.lower()
    assert reply.endswith("?")


def test_build_draft_tutor_reply_gently_corrects_wrong_short_math_follow_up() -> None:
    reply = build_draft_tutor_reply(
        subject="math",
        grade_band="6-8",
        latest_student_text="5",
        history=[
            {"role": "user", "content": "2+2"},
            {"role": "assistant", "content": "What result do you get?"},
        ],
    )

    assert "2+2" in reply
    assert "5" not in reply
    assert "what total" in reply.lower()
    assert reply.endswith("?")


def test_build_draft_tutor_reply_handles_equation_step_follow_up() -> None:
    reply = build_draft_tutor_reply(
        subject="math",
        grade_band="6-8",
        latest_student_text="subtract 4",
        history=[
            {"role": "user", "content": "The equation is 2x + 4 = 10"},
            {"role": "assistant", "content": "What should you do first to get x by itself?"},
        ],
    )

    assert "2x + 4 = 10" in reply
    assert "subtract 4" in reply.lower()
    assert "what equation" in reply.lower()
    assert reply.endswith("?")


def test_build_draft_tutor_reply_handles_fresh_math_expression_with_question_mark() -> None:
    reply = build_draft_tutor_reply(
        subject="math",
        grade_band="6-8",
        latest_student_text="2+2?",
    )

    assert reply == "Let's work on 2+2. What total do you get when you add 2 and 2?"


def test_build_draft_tutor_reply_handles_help_request_for_active_math_problem() -> None:
    reply = build_draft_tutor_reply(
        subject="math",
        grade_band="6-8",
        latest_student_text="yes pelase help me to sovle it",
        history=[
            {"role": "user", "content": "2+2?"},
            {
                "role": "assistant",
                "content": "Let's work on 2+2. What total do you get when you add 2 and 2?",
            },
        ],
    )

    assert reply == "Great, let's go step by step. What do you get if you start with 2 and add 2?"
