# Task 04: MiniMax LLM Path

## Goal

Implement the primary streamed tutor-text path.

## Owner

Backend integrations engineer

## Depends On

- Task 02

## Planned Files

- `backend/llm/minimax_client.py`
- `backend/llm/prompt_builder.py`
- `backend/llm/response_policy.py`

## Deliverables

- MiniMax client
- shared prompt contract
- short-turn response policy
- first-token timing hooks

## Done Criteria

- tutor text streams
- `llm_first_token` is recorded
- responses stay short and Socratic

## Parallel

Can run in parallel with Task 03 after Task 02 lands.
Blocks Tasks 05 and 06.
