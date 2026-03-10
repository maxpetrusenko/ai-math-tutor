from eval.socratic_checks import score_tutor_turn


def test_score_tutor_turn_rewards_forward_question_and_encouragement() -> None:
    result = score_tutor_turn(
        tutor_text="Nice start. What happens to the 5 when you move it to the other side?",
        expected_concept="linear equations",
        grade_band="6-8",
    )

    assert result["Socratic questioning"] == 5
    assert result["Encouragement"] >= 4
    assert result["Direct-answer avoidance"] == 5


def test_score_tutor_turn_penalizes_direct_answer_leakage() -> None:
    result = score_tutor_turn(
        tutor_text="The answer is x = 5.",
        expected_concept="linear equations",
        grade_band="6-8",
    )

    assert result["Socratic questioning"] <= 2
    assert result["Direct-answer avoidance"] == 1


def test_score_tutor_turn_uses_grade_band_language_rules() -> None:
    result = score_tutor_turn(
        tutor_text="Can you identify which subject and verb disagree in this sentence?",
        expected_concept="subject-verb agreement",
        grade_band="11-12",
    )

    assert result["Grade fit"] >= 4
    assert result["Correctness"] >= 4
