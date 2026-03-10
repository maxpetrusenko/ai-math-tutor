# Task 05: Gemini Fallback Path

## Goal

Implement the fallback LLM path behind the same interface.

## Owner

Backend integrations engineer

## Depends On

- Task 04

## Planned Files

- `backend/llm/gemini_fallback_client.py`
- `backend/llm/provider_switch.py`

## Deliverables

- Gemini fallback client
- provider switch support

## Done Criteria

- same prompt contract runs on fallback
- fallback can replace the primary without frontend changes

## Parallel

Can run in parallel with Task 06 once Task 04 is stable.
