from __future__ import annotations

import json
from pathlib import Path


def test_eval_turns_cover_all_subject_tracks() -> None:
    payload = json.loads(Path("eval/test_turns.json").read_text())

    assert {track["subject"] for track in payload["tracks"]} == {
        "math",
        "science",
        "english",
    }
    first_turn = payload["tracks"][0]["turns"][0]
    assert first_turn["grade_band"] in {"6-8", "9-10", "11-12"}
    assert first_turn["student_utterance"]
    assert first_turn["expected_concept"]
    assert first_turn["rubric_hooks"]


def test_rubric_mentions_required_dimensions_and_pass_bars() -> None:
    rubric = Path("eval/rubric.md").read_text()

    assert "Socratic questioning" in rubric
    assert "Scaffolding quality" in rubric
    assert "Direct-answer avoidance" in rubric
    assert "Correctness" in rubric
    assert "Grade fit" in rubric
    assert "Encouragement" in rubric
    assert "no dimension below 3" in rubric
    assert "Socratic questioning average at least 4" in rubric
