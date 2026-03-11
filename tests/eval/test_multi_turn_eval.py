from __future__ import annotations

import json
from pathlib import Path

from eval.socratic_checks import score_multi_turn_lesson


def test_multi_turn_fixtures_cover_core_subjects_and_lock_demo_shape() -> None:
    fixture_dir = Path("eval/fixtures/multi_turn")
    payloads = [json.loads(path.read_text()) for path in sorted(fixture_dir.glob("*.json"))]

    assert {payload["subject"] for payload in payloads} == {"math", "science", "english"}

    for payload in payloads:
        assert payload["demo"]["locked"] is True
        assert payload["demo"]["transport_mode"] == "fixture"
        assert payload["demo"]["avatar_preset"] in {
            "human-css-2d",
            "robot-css-2d",
            "human-threejs-3d",
        }
        assert len(payload["turns"]) >= 3
        assert payload["turns"][0]["turn_goal"] == "diagnose"
        assert payload["turns"][-1]["turn_goal"] == "reflect"
    assert any(
        turn["student_outcome"] == "incorrect"
        for payload in payloads
        for turn in payload["turns"]
    )


def test_multi_turn_score_rewards_socratic_follow_up_and_lesson_arc() -> None:
    math_fixture = json.loads(Path("eval/fixtures/multi_turn/math-linear-equations.json").read_text())

    scores = score_multi_turn_lesson(
        turns=math_fixture["turns"],
        expected_concept=math_fixture["concept"],
        grade_band=math_fixture["grade_band"],
    )

    assert scores["Socratic quality"] >= 4
    assert scores["Follow-up continuity"] >= 4
    assert scores["Grade fit"] >= 4
    assert scores["Lesson arc"] >= 4


def test_multi_turn_score_penalizes_correction_style_when_tutor_blurts_the_answer() -> None:
    scores = score_multi_turn_lesson(
        turns=[
            {
                "student_utterance": "I think x is 9",
                "student_outcome": "incorrect",
                "tutor_response": "The answer is x = 5.",
                "turn_goal": "correct",
            },
            {
                "student_utterance": "Oh",
                "student_outcome": "correct",
                "tutor_response": "Do you see why?",
                "turn_goal": "reflect",
            },
        ],
        expected_concept="linear equations",
        grade_band="6-8",
    )

    assert scores["Correction style"] <= 2


def test_multi_turn_score_penalizes_stale_topic_leakage_after_student_shift() -> None:
    scores = score_multi_turn_lesson(
        turns=[
            {
                "student_utterance": "I don't understand how to solve for x.",
                "student_outcome": "unsure",
                "tutor_response": "What equation are you working with?",
                "turn_goal": "diagnose",
            },
            {
                "student_utterance": "1+1",
                "student_outcome": "partial",
                "tutor_response": "For x, what should you subtract first?",
                "turn_goal": "guide",
            },
        ],
        expected_concept="linear equations",
        grade_band="6-8",
    )

    assert scores["Topical relevance"] <= 2
