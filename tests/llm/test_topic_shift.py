from backend.llm.topic_shift import filter_history_for_latest_turn


def test_filter_history_for_latest_turn_clears_math_history_on_subtopic_shift() -> None:
    history = [
        {"role": "user", "content": "I don't understand how to solve for x."},
        {"role": "assistant", "content": "What equation are you working with?"},
    ]

    filtered = filter_history_for_latest_turn(
        subject="math",
        latest_student_text="1+1",
        history=history,
    )

    assert filtered == []


def test_filter_history_for_latest_turn_keeps_history_for_short_math_follow_up() -> None:
    history = [
        {"role": "user", "content": "2+2"},
        {"role": "assistant", "content": "What result do you get?"},
    ]

    filtered = filter_history_for_latest_turn(
        subject="math",
        latest_student_text="4",
        history=history,
    )

    assert filtered == history


def test_filter_history_for_latest_turn_keeps_only_latest_topic_block() -> None:
    history = [
        {"role": "user", "content": "I don't understand how to solve for x."},
        {"role": "assistant", "content": "What equation are you working with?"},
        {"role": "user", "content": "1+1"},
        {"role": "assistant", "content": "Nice start. What part can you check first?"},
    ]

    filtered = filter_history_for_latest_turn(
        subject="math",
        latest_student_text="2",
        history=history,
    )

    assert filtered == history[2:]


def test_filter_history_for_latest_turn_drops_older_arithmetic_problem_block() -> None:
    history = [
        {"role": "user", "content": "2+2"},
        {"role": "assistant", "content": "What result do you get when you add 2 and 2?"},
        {"role": "user", "content": "1+1"},
        {"role": "assistant", "content": "What result do you get when you add 1 and 1?"},
    ]

    filtered = filter_history_for_latest_turn(
        subject="math",
        latest_student_text="2",
        history=history,
    )

    assert filtered == history[2:]
