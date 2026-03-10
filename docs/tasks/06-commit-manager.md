# Task 06: Commit Manager

## Goal

Build committed playback logic for stable phrases and sentence boundaries.

## Owner

Backend engineer

## Depends On

- Task 04

## Planned Files

- `backend/tts/commit_manager.py`
- `backend/tts/chunk_policy.py`

## Deliverables

- commit manager
- sentence and phrase commit modes
- interruption-safe reset behavior

## Done Criteria

- unstable trailing fragments never reach playback
- phrase and sentence modes are testable

## Parallel

Can run in parallel with Task 05 once Task 04 is stable.
Blocks Task 07.
