from backend.turn_taking.transcript_commit import TranscriptCommitter


def test_transcript_committer_emits_stable_partial_after_repeat() -> None:
    committer = TranscriptCommitter(stability_repeats=2)

    first = committer.push_partial("solve for x")
    second = committer.push_partial("solve for x")

    assert first is None
    assert second == "solve for x"


def test_transcript_committer_prefers_final_text_when_available() -> None:
    committer = TranscriptCommitter(stability_repeats=3)
    committer.push_partial("what about")

    final = committer.push_final("what about photosynthesis")

    assert final == "what about photosynthesis"
    assert committer.last_committed_text == "what about photosynthesis"
