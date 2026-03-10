# Task 25: Lesson Session and Text Turns

## Goal

Turn the current demo shell into an explicit lesson loop with visible history, text-only send, follow-up turns, and a real `New Lesson` reset.

## Owner

Frontend / backend realtime engineer

## Depends On

- Task 17
- Task 23

## Planned Files

- `frontend/components/TutorSession.tsx`
- `frontend/components/ConversationHistory.tsx`
- `frontend/lib/session_socket.ts`
- `backend/session/server.py`
- `backend/turn_taking/controller.py`
- `tests/session/test_server_pipeline.py`
- `frontend/components/TutorSession.test.tsx`

## Deliverables

- `Send Text Turn` action
- visible history panel
- follow-up turn behavior in one session
- `New Lesson` reset path

## Done Criteria

- text-only use is obvious in the UI
- a follow-up question uses session history
- `New Lesson` clears history, profile, and lesson state
- typed and voice paths both land in the same session model

## Parallel

Can run alongside Task 24 after session-reset event shape is agreed.
