# Multi-Turn Lesson Fixtures

Fixed multi-turn conversation fixtures for evaluating Socratic quality across follow-up turns.

## Purpose

Single-turn evals measure isolated tutor responses. Multi-turn evals measure:
- Conversation continuity
- Progressive scaffolding
- Learning arc completion
- Session history usage

## Files

| File | Subject | Concept | Grade Band | Turns |
|------|---------|----------|------------|-------|
| `math-linear-equations.json` | Math | Linear equations | 6-8 | 5 |
| `science_photosynthesis.json` | Science | Photosynthesis basics | 9-10 | 5 |
| `english_subject_verb.json` | English | Subject-verb agreement | 11-12 | 5 |

## Fixture Format

```json
{
  "id": "unique_id",
  "subject": "math|science|english",
  "concept": "concept_name",
  "grade_band": "6-8|9-10|11-12",
  "description": "Human-readable description",
  "target_turns": 5,
  "learning_arc": ["step1", "step2", ...],
  "turns": [
    {
      "turn_number": 1,
      "student_utterance": "What student says",
      "expected_tutor_behavior": {
        "asks_question": true,
        "scaffolds": true,
        "ends_with_forward_question": true
      },
      "rubric_hooks": ["socratic", "scaffolds", ...]
    }
  ],
  "success_indicators": {
    "socratic_question_ratio": 0.8,
    "student_speaks_at_least": 3,
    "concept_progression": ["list", "of", "milestones"]
  }
}
```

## Evaluation

Run fixtures through the backend session server with history enabled. Score each turn against:
- Socratic questioning (ends with question?)
- Scaffolding quality (builds step by step?)
- Direct-answer avoidance (no giving away?)
- Correctness (accurate content?)
- Grade fit (appropriate language?)
- Encouragement (positive feedback?)

## Pass Bars

- No dimension below 3
- Socratic questioning average at least 4
- Correctness average at least 4
- Learning arc shows clear progression
