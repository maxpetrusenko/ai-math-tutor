# Task 16: Frontend Latency and Sync Instrumentation

## Goal

Replace placeholder latency values with real frontend timing and sync events needed for benchmark closure.

## Owner

Frontend / performance engineer

## Depends On

- Task 07
- Task 09
- Task 10
- Task 15

## Planned Files

- `frontend/components/TutorSession.tsx`
- `frontend/components/LatencyMonitor.tsx`
- `frontend/components/AvatarRenderer.tsx`
- `frontend/lib/session_metrics.ts`

## Deliverables

- real `tts_first_audio` display path
- `first_viseme` capture
- `audio_done` capture
- live metric updates in UI
- exportable timing records for benchmark runs

## Done Criteria

- UI shows real metrics instead of hard-coded numbers
- avatar and audio timing can be compared from the same run
- benchmark-required frontend events are captured consistently

## Parallel

After real mic and playback exist.
