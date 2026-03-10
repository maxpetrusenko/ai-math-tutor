# Task 15: Browser Mic Streaming

## Goal

Replace the toggle-only mic UI with real browser capture and live audio chunk streaming to the backend session WebSocket.

## Owner

Frontend / realtime engineer

## Depends On

- Task 02
- Task 03
- Task 08
- Task 10

## Planned Files

- `frontend/components/MicCapture.tsx`
- `frontend/components/TutorSession.tsx`
- `frontend/lib/audio_capture.ts`
- `frontend/lib/session_socket.ts`

## Deliverables

- browser mic permission flow
- PCM or provider-ready chunk capture
- `audio.chunk` event stream
- `speech.end` trigger from real capture
- visible mic error states

## Done Criteria

- user can talk into browser mic
- backend receives real audio chunks
- live capture can produce a full tutoring turn
- typed fallback remains available for local debugging

## Parallel

After Task 10 playback behavior is stable.
