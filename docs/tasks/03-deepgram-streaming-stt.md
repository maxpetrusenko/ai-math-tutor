# Task 03: Deepgram Streaming STT

## Goal

Implement Deepgram streaming STT and transcript stabilization.

## Owner

Backend integrations engineer

## Depends On

- Task 02

## Planned Files

- `backend/stt/deepgram_client.py`
- `backend/turn_taking/transcript_commit.py`

## Deliverables

- Deepgram streaming client
- partial transcript handling
- stable transcript commit rules
- Nova-3 fallback path if needed

## Done Criteria

- partial and final transcript events work
- `stt_partial_stable` and `stt_final` are recorded
- short-answer turn stability is acceptable

## Parallel

Can run in parallel with Task 04 after Task 02 lands.
