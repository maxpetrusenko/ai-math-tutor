# Multi-Turn Eval Summary

This report scores the locked multi-turn lesson fixtures used for demo prep and reviewer handoff.

## Fixture Scorecard

| Fixture | Subject | Concept | Grade Band | Avatar | Socratic quality | Follow-up continuity | Grade fit | Lesson arc | Correction style |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| `english_subject_verb.json` | english | subject-verb agreement | 11-12 | `human-css-2d` | 5 | 5 | 4 | 5 | 5 |
| `math-linear-equations.json` | math | linear equations | 6-8 | `human-css-2d` | 5 | 5 | 5 | 5 | 5 |
| `science_photosynthesis.json` | science | photosynthesis basics | 9-10 | `human-css-2d` | 5 | 5 | 4 | 5 | 5 |

## Locked Demo Notes

- Transport mode stays `fixture` for repeatable rehearsal and browser smoke.
- Demo-safe presets stay inside the frozen set: `human-css-2d`, `robot-css-2d`, `human-threejs-3d`.
- All three fixtures maintain a diagnose -> guide/practice -> verify/reflect lesson arc.
- All three fixtures score `4+ / 5` on every rubric dimension; two score perfect `5 / 5` for Socratic quality and follow-up continuity.

## Score Dimensions

- `Socratic quality` is scored on the current 1-5 rubric in `eval/socratic_checks.py`.
- `Follow-up continuity` is scored on the current 1-5 rubric in `eval/socratic_checks.py`.
- `Grade fit` is scored on the current 1-5 rubric in `eval/socratic_checks.py`.
- `Lesson arc` is scored on the current 1-5 rubric in `eval/socratic_checks.py`.
- `Correction style` is scored on the current 1-5 rubric in `eval/socratic_checks.py`.

## Remaining Dependency

The runtime benchmark now closes the hard latency gate on the shipped fast path.
The public-provider bakeoff remains a comparison lane, not the primary acceptance lane.
