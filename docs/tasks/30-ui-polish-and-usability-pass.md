# Task 30: UI Polish and Usability Pass

## Goal

Make the tutor feel coherent, readable, and demo-ready across desktop and mobile without changing the core session architecture.

## Owner

Frontend / product design engineer

## Depends On

- Task 23
- Task 25
- Task 26

## Planned Files

- `frontend/components/TutorSession.tsx`
- `frontend/components/AvatarSelector.tsx`
- `frontend/components/ConversationHistory.tsx`
- `frontend/components/MicCapture.tsx`
- `frontend/app/globals.css`
- `frontend/e2e/*.spec.ts`

## Deliverables

- clearer layout hierarchy for lesson flow
- better text vs mic controls
- clearer `New Lesson` affordance
- stronger history panel readability
- improved avatar selector presentation
- mobile responsiveness pass
- accessibility and empty/loading/error state polish

## Suggested Subtasks

- `30.1` session layout and hierarchy cleanup
- `30.2` CTA clarity for text turn, mic turn, interrupt, and new lesson
- `30.3` history panel and avatar selector polish
- `30.4` mobile + accessibility pass
- `30.5` loading, empty, and error state cleanup

## Done Criteria

- a reviewer can immediately tell how to send text, use mic, follow up, and reset lesson
- the page reads clearly on laptop and phone sizes
- key controls are keyboard accessible and labeled
- the UI looks intentional enough for demo recording

## Parallel

Start after Task 23 and Task 25 contracts are stable. Finish before the live benchmark bakeoff and demo recording.
