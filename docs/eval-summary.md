# Multi-Turn Eval Summary

This report captures the locked multi-turn lesson fixtures used for the demo pack and reviewer handoff.

## Fixture Scorecard

| Fixture | Subject | Concept | Grade Band | Avatar | Socratic quality | Follow-up continuity | Grade fit | Lesson arc | Correction style |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| `english_subject_verb.json` | english | subject-verb agreement | 6-8 | `robot-css-2d` | 5 | 5 | 4 | 5 | 5 |
| `math-linear-equations.json` | math | linear equations | 6-8 | `human-css-2d` | 4 | 5 | 5 | 5 | 5 |
| `science_photosynthesis.json` | science | photosynthesis basics | 6-8 | `human-threejs-3d` | 3 | 5 | 4 | 5 | 5 |

## Locked Demo Notes

- Transport mode stays `fixture` for repeatable rehearsal and browser smoke.
- Demo-safe presets stay inside the frozen set: `human-css-2d`, `robot-css-2d`, `human-threejs-3d`.
- Each lesson arc shows diagnose -> guide/practice -> verify/reflect progression.

## Score Dimensions

- `Socratic quality` tracks question-led tutoring and encouragement.
- `Follow-up continuity` tracks whether the tutor keeps building on the same concept across turns.
- `Grade fit` tracks age-appropriate language.
- `Lesson arc` tracks progression from confusion to understanding.
- `Correction style` rewards gentle redirects and penalizes blurting the answer.

Topic-shift handling is a required manual regression check even though it is not part of the current scorecard.

## Remaining Dependency

Task 27 remains the only missing live-proof dependency.
The pedagogy pack, demo lock, and acceptance evidence are ready for handoff; live benchmark links still land separately.
