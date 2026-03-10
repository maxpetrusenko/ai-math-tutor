from backend.llm.response_policy import shape_tutor_response


def test_shape_tutor_response_keeps_short_question_led_turn() -> None:
    shaped = shape_tutor_response(
        "Nice start. Let's isolate x. Subtract 5 from both sides. What should you do next?"
    )

    assert shaped.count(".") <= 2
    assert shaped.endswith("?")


def test_shape_tutor_response_rewrites_direct_answer_style() -> None:
    shaped = shape_tutor_response("The answer is x = 5.")

    assert "the answer is" not in shaped.lower()
    assert shaped.endswith("?")
