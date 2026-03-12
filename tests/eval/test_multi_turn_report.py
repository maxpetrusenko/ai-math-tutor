from eval.multi_turn_report import build_multi_turn_eval_report, load_multi_turn_fixture_scores


def test_multi_turn_report_covers_all_locked_subjects() -> None:
    summaries = load_multi_turn_fixture_scores()

    assert {summary.subject for summary in summaries} == {"math", "science", "english"}

    for summary in summaries:
        assert summary.demo_locked is True
        assert summary.transport_mode == "fixture"
        assert summary.avatar_preset in {
            "human-css-2d",
            "robot-css-2d",
            "human-threejs-3d",
        }
        assert summary.scores["Socratic quality"] >= 3
        assert summary.scores["Follow-up continuity"] >= 4
        assert summary.scores["Grade fit"] >= 4
        assert summary.scores["Lesson arc"] >= 4


def test_multi_turn_report_markdown_mentions_fixtures_and_score_dimensions() -> None:
    report = build_multi_turn_eval_report()

    assert "math-linear-equations.json" in report
    assert "science_photosynthesis.json" in report
    assert "english_subject_verb.json" in report
    assert "Socratic quality" in report
    assert "Follow-up continuity" in report
    assert "Lesson arc" in report
    assert "runtime benchmark now closes the hard latency gate" in report
