from __future__ import annotations

import json
from pathlib import Path


def test_canned_prompts_fixture_has_required_schema() -> None:
    payload = json.loads(Path("backend/benchmarks/canned_prompts.json").read_text())

    assert len(payload["prompts"]) >= 3
    assert {prompt["subject"] for prompt in payload["prompts"]} == {
        "math",
        "science",
        "english",
    }
    first_prompt = payload["prompts"][0]
    assert first_prompt["grade_band"] in {"6-8", "9-10", "11-12"}
    assert isinstance(first_prompt["student_transcript"], str)
    assert first_prompt["student_transcript"]
    assert isinstance(first_prompt["tags"], list)
    assert first_prompt["tags"]
