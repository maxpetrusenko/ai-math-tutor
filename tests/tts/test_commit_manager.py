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
