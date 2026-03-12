from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from eval.socratic_checks import score_multi_turn_lesson

_FIXTURE_DIR = Path("eval/fixtures/multi_turn")
_SCORE_ORDER = (
    "Socratic quality",
    "Follow-up continuity",
    "Grade fit",
    "Lesson arc",
    "Correction style",
)


@dataclass(frozen=True, slots=True)
class MultiTurnFixtureScore:
    fixture_name: str
    subject: str
    concept: str
    grade_band: str
    avatar_preset: str
    demo_locked: bool
    transport_mode: str
    scores: dict[str, int]


def load_multi_turn_fixture_scores() -> list[MultiTurnFixtureScore]:
    summaries: list[MultiTurnFixtureScore] = []

    for path in sorted(_FIXTURE_DIR.glob("*.json")):
        payload = json.loads(path.read_text())
        summaries.append(
            MultiTurnFixtureScore(
                fixture_name=path.name,
                subject=payload["subject"],
                concept=payload["concept"],
                grade_band=payload["grade_band"],
                avatar_preset=payload["demo"]["avatar_preset"],
                demo_locked=bool(payload["demo"]["locked"]),
                transport_mode=payload["demo"]["transport_mode"],
                scores=score_multi_turn_lesson(
                    turns=payload["turns"],
                    expected_concept=payload["concept"],
                    grade_band=payload["grade_band"],
                ),
            )
        )

    return summaries


def build_multi_turn_eval_report() -> str:
    summaries = load_multi_turn_fixture_scores()
    lines = [
        "# Multi-Turn Eval Summary",
        "",
        "This report scores the locked multi-turn lesson fixtures used for demo prep and reviewer handoff.",
        "",
        "## Fixture Scorecard",
        "",
        "| Fixture | Subject | Concept | Grade Band | Avatar | Socratic quality | Follow-up continuity | Grade fit | Lesson arc | Correction style |",
        "| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ]

    for summary in summaries:
        lines.append(
            f"| `{summary.fixture_name}` | {summary.subject} | {summary.concept} | {summary.grade_band} | `{summary.avatar_preset}` | "
            f"{summary.scores['Socratic quality']} | {summary.scores['Follow-up continuity']} | {summary.scores['Grade fit']} | "
            f"{summary.scores['Lesson arc']} | {summary.scores['Correction style']} |"
        )

    lines.extend(
        [
            "",
            "## Locked Demo Notes",
            "",
            "- Transport mode stays `fixture` for repeatable rehearsal and browser smoke.",
            "- Demo-safe presets stay inside the frozen set: `human-css-2d`, `robot-css-2d`, `human-threejs-3d`.",
            "- All three fixtures maintain a diagnose -> guide/practice -> verify/reflect lesson arc.",
            "",
            "## Score Dimensions",
            "",
        ]
    )

    for dimension in _SCORE_ORDER:
        lines.append(f"- `{dimension}` is scored on the current 1-5 rubric in `eval/socratic_checks.py`.")

    lines.extend(
        [
            "",
            "## Remaining Dependency",
            "",
            "The runtime benchmark now closes the hard latency gate on the shipped fast path.",
            "The public-provider bakeoff remains a comparison lane, not the primary acceptance lane.",
        ]
    )

    return "\n".join(lines) + "\n"
