from pathlib import Path


def test_closure_lane_status_surfaces_match_current_plan() -> None:
    readme = Path("README.md").read_text()
    task_index = Path("docs/tasks/README.md").read_text()
    checklist = Path("docs/submission-checklist.md").read_text()

    assert "- Lane E `live benchmark closure`: done" in readme
    assert "- Lane F `pedagogy + demo + acceptance`: done" in readme
    assert "- Lane G `cost + licensing`: done" in readme
    assert "- Lane H `UI polish`: done" in readme

    assert "- Lane E / Task 27: done" in task_index
    assert "- Lane F / Task 28: done" in task_index
    assert "- Lane G / Task 29: done" in task_index
    assert "- Lane H / Task 30: done" in task_index

    assert "- [x] Lane E / Task 27 complete" in checklist
    assert "- [x] Lane F / Task 28 complete" in checklist
    assert "- [x] Lane G / Task 29 complete" in checklist
    assert "- [x] Lane H / Task 30 complete" in checklist
