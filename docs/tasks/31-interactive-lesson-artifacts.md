# Task 31: Interactive Lesson Artifacts

## Draft Review Note

This task is not fully flushed.

It is a working product + architecture draft and needs review before implementation starts.

Review focus:

- product split between Tutor Session and Lessons
- panel placement in `/session`
- artifact state contract
- tutor tool contract
- Yjs timing and transport choice
- asset policy for visual lesson pieces

## Goal

Add an interactive lesson artifact surface to `/session` so the tutor can teach with manipulable visuals, not only text, voice, and avatar motion.

Initial anchor example:

- fractions with pizza slices

## Owner

Frontend / product / realtime engineer

## Depends On

- Task 25
- Task 30

## Planned Files

- `frontend/components/TutorSession.tsx`
- `frontend/components/session/TutorSessionAvatarStage.tsx`
- `frontend/components/session/TutorSessionComposer.tsx`
- `frontend/components/session/LessonArtifactPanel.tsx`
- `frontend/components/session/artifacts/FractionPizzaArtifact.tsx`
- `frontend/components/session/artifacts/FractionBarArtifact.tsx`
- `frontend/lib/artifacts/artifact_types.ts`
- `frontend/lib/artifacts/artifact_doc.ts`
- `frontend/lib/artifacts/artifact_store.ts`
- `frontend/lib/artifacts/artifact_yjs.ts`
- `frontend/lib/lesson_thread_store.ts`
- `frontend/app/globals.css`
- `backend/session/server.py`
- `tests/session/test_server.py`
- `frontend/components/TutorSession.test.tsx`
- `frontend/lib/lesson_thread_store.test.ts`

## Deliverables

- dedicated lesson artifact panel inside `/session`
- first manipulative: `fraction-pizza`
- local save/restore of artifact state with the lesson thread
- tutor-triggered artifact open/update contract
- explicit split between open-ended Tutor Session and guided Lessons
- `circle` tool and `knife` tool interaction model
- pizza cut depth capped at `1/16`
- later-ready path for Yjs sync

## Product Split

### Mode A: Tutor Session

Use when the learner asks a free-form question.

Expected behavior:

- open-ended only
- no lesson artifact auto-open
- no forced manipulative workflow
- tutor stays conversational and exploratory
- if artifact support ever lands here, it should be explicit and lightweight, not the default path

### Mode B: Lessons open

Use when the learner opens a lesson from `/lessons`.

Expected behavior:

- tutor opens with voice and first question
- artifact auto-opens for concept lessons that need it
- fractions example: lesson opens with a pizza already on stage
- learner replies by voice, text, and direct manipulation
- tutor reacts to both spoken reply and artifact state

### Mode C: Lessons reply loop

Use after lesson start.

Expected behavior:

- artifact remains part of the turn loop, not a detached side toy
- learner moves pieces
- tutor notices progress/errors and responds
- tutor can update highlights, labels, and goals between turns

### Mode D: Lessons resume / replay

Use when the learner resumes an active or archived lesson.

Expected behavior:

- restore artifact state with the lesson thread
- restore the current task and tutor question
- avoid resetting the visual state unless the learner explicitly resets

### Mode E: Tutor demo step

Optional later mode.

Expected behavior:

- tutor can briefly animate or highlight the next step
- learner can then take back control

## Artifact Tools

### `circle` tool

Primary object creation tool.

Expected behavior:

- create a pizza / fraction circle
- start whole, then become segmented
- support direct drag after creation
- support combine behavior when pieces are moved together into one valid whole

### `knife` tool

Primary cut tool.

Expected behavior:

- cut a circle into equal fractional parts
- if used over a whole circle, split it into equal wedges
- if used over an already cut pizza, allow another equal subdivision when valid
- after a cut, pieces separate slightly so the learner can grab them
- max denominator / cut depth is `1/16`

Rules:

- only equal cuts for v1
- no freehand arbitrary slice paths
- cap at denominators `1`, `2`, `4`, `8`, `16`
- invalid cuts should be blocked, not approximated

## Suggested Subtasks

- `31.1` add `LessonArtifactPanel` frame to `/session`
- `31.2` define artifact schema and persisted lesson-thread shape
- `31.3` ship repo-original `fraction-pizza` with `circle` + `knife` tools, drag, combine, pull-apart, fill, reset
- `31.4` add lesson-open seed rules so Lessons can auto-open artifact state
- `31.5` add tutor action contract for `create/update/highlight/reset` artifact commands in Lessons
- `31.6` persist and restore lesson artifact state on lesson resume
- `31.7` wrap lesson artifact state in Yjs locally
- `31.8` add multi-tab / multi-client sync only after single-user lesson UX is solid

## Technical Direction

Recommended v1:

- custom artifact panel, not generic whiteboard
- repo-original SVG or canvas primitives, not downloaded pizza photos
- local state first
- persisted lesson-thread snapshot
- narrow tutor action contract
- deterministic pizza segmentation rules
- `circle` and `knife` as explicit domain tools, not generic drawing tools

Recommended later:

- Yjs for artifact doc state
- `y-indexeddb` for local-first persistence
- dedicated artifact sync channel if multi-client sync is needed

Avoid for first ship:

- arbitrary artifact code execution
- mixing artifact sync into the current audio websocket path
- full tldraw embed as the default surface

## Done Criteria

- Tutor Session remains open-ended and does not auto-open lesson artifacts
- a fractions lesson can start with tutor voice plus seeded pizza artifact
- a learner can create or receive a circle, cut it with the knife, and move pieces apart
- the learner can combine valid pieces by moving them together
- the pizza cannot be cut beyond `1/16`
- tutor replies still feel like one lesson loop, not two disconnected systems
- lesson artifact state survives lesson resume
- the task passes review on product split before multiplayer scope opens

## Review Questions

- should all concept lessons auto-open artifacts or only lessons tagged as visual/manipulative
- should artifact actions be their own tool calls or plain session events
- should v1 include only fraction circles first or also bars / number lines
- should `circle` and `knife` be visible toolbar tools or tutor-invoked controls plus learner affordances
- what exact state should be persisted in the lesson thread vs ephemeral Yjs awareness

## Parallel

Do not start implementation until this draft is reviewed.

After review:

- `31.1` to `31.4` can run before Yjs
- `31.5` can start once the lesson action contract is accepted
- `31.7` and `31.8` should wait until single-user UX is good
