from backend.tts.chunk_policy import chunk_text
from backend.tts.commit_manager import CommitManager


def test_chunk_text_sentence_mode_waits_for_sentence_boundary() -> None:
    chunks = chunk_text(
        "Nice start. Subtract 5 from both sides. What should you do next?",
        mode="sentence",
    )

    assert chunks == [
        "Nice start.",
        "Subtract 5 from both sides.",
        "What should you do next?",
    ]


def test_chunk_text_phrase_mode_splits_long_conversational_reply_at_sentence_and_phrase_boundaries() -> None:
    chunks = chunk_text(
        "That’s okay! Let’s break it down step-by-step. If you think of two as one group of two objects, and you add another group of two objects, how many do you have in total? What do you get when you combine them?",
        mode="phrase",
    )

    assert chunks == [
        "That’s okay!",
        "Let’s break it down step-by-step.",
        "If you think of two as one group of two objects,",
        "and you add another group of two objects,",
        "how many do you have in total?",
        "What do you get when you combine them?",
    ]


def test_commit_manager_phrase_mode_commits_stable_phrases_only() -> None:
    manager = CommitManager(mode="phrase")

    manager.push_token("Nice")
    manager.push_token(" start,")
    first = manager.emit_committed_phrase()
    manager.push_token(" what")
    manager.push_token(" should")
    manager.push_token(" you do next?")
    second = manager.emit_committed_phrase()

    assert first == "Nice start,"
    assert second == "what should you do next?"


def test_commit_manager_reset_clears_uncommitted_state() -> None:
    manager = CommitManager(mode="phrase")
    manager.push_token("Partial")
    manager.reset()

    assert manager.emit_committed_phrase() is None


def test_commit_manager_phrase_mode_keeps_full_socratic_reply_after_initial_phrase_commit() -> None:
    manager = CommitManager(mode="phrase")

    manager.push_token("Great")
    manager.push_token(",")
    first = manager.emit_committed_phrase()
    manager.push_token(" let's")
    manager.push_token(" go")
    manager.push_token(" step")
    manager.push_token(" by")
    manager.push_token(" step.")
    manager.push_token(" What")
    manager.push_token(" do")
    manager.push_token(" you")
    manager.push_token(" get")
    manager.push_token(" if")
    manager.push_token(" you")
    manager.push_token(" start")
    manager.push_token(" with")
    manager.push_token(" 2")
    manager.push_token(" and")
    manager.push_token(" add")
    manager.push_token(" 2?")

    remaining = manager.finish_turn()

    assert first == "Great,"
    assert remaining == [
        "let's go step by step.",
        "What do you get if you start with 2 and add 2?",
    ]
