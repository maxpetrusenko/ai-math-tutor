# Task 17: Session Context and Personalization

## Goal

Carry the required session inputs through the loop: subject, grade band, conversation history, and optional pacing or learning preferences.

## Owner

Backend / product engineer

## Depends On

- Task 02
- Task 04
- Task 08

## Planned Files

- `backend/llm/prompt_builder.py`
- `backend/session/server.py`
- `frontend/components/TutorSession.tsx`
- `tests/llm/test_prompt_builder.py`
- `tests/session/test_server_pipeline.py`

## Deliverables

- session context contract
- prompt-builder support for history and preferences
- UI controls for subject and grade band
- carry-forward history between turns

## Done Criteria

- grade band and subject are explicit inputs to each turn
- history affects prompt construction
- optional pacing or preference input is available without breaking MVP simplicity

## Parallel

After Task 04 prompt contract is stable.
