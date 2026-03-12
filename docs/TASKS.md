# Task Breakdown

Date: 2026-03-08  
Status: aligned to MVP baseline

## Closure Status

As of 2026-03-12:

- Tasks 23-26: done
- Task 27: done for the engineering acceptance lane
- Task 28: done
- Task 29: done
- Task 30: done
- Task 31: draft only, needs review

## 1. Purpose

Break the MVP plan into assignable work without guessing.

This task set now assumes:

- WebSocket transport
- client-side 2D avatar
- benchmark-first delivery
- photoreal avatar work deferred

## 2. Task 1: Benchmark Harness

Owner:

- backend / performance engineer

Goal:

- build the Phase 0 benchmark gate and reporting path

Dependencies:

- none

Deliverables:

- latency tracker
- canned prompt runner
- p50 and p95 report output
- benchmark result template

Done criteria:

- 30-run batches execute
- required events are captured
- kill criteria can be evaluated from output

## 3. Task 2: WebSocket Session Server

Owner:

- backend realtime engineer

Goal:

- implement the backend WebSocket session path and single turn-boundary authority

Dependencies:

- Task 1 event schema

Deliverables:

- session WebSocket endpoint
- session state machine
- interruption handling

Done criteria:

- client can connect, stream audio, and receive tutor events
- one component clearly owns turn state

## 4. Task 3: Deepgram Streaming STT

Owner:

- backend integrations engineer

Goal:

- implement Deepgram streaming STT and transcript stabilization

Dependencies:

- Task 2

Deliverables:

- Deepgram client
- partial transcript handling
- stable transcript commit logic

Done criteria:

- partial and final transcript events work
- `stt_partial_stable` and `stt_final` are recorded

## 5. Task 4: MiniMax LLM Path

Owner:

- backend integrations engineer

Goal:

- implement the primary streamed tutor-text path

Dependencies:

- Task 2

Deliverables:

- MiniMax client
- shared prompt builder
- short-turn response policy

Done criteria:

- tutor text streams
- `llm_first_token` is recorded
- response rules enforce short Socratic turns

## 6. Task 5: Gemini Fallback Path

Owner:

- backend integrations engineer

Goal:

- implement the fallback LLM path

Dependencies:

- Task 4

Deliverables:

- Gemini client
- provider switch

Done criteria:

- fallback path can run the same prompt contract
- fallback can be used without changing frontend flow

## 7. Task 6: Commit Manager

Owner:

- backend engineer

Goal:

- build committed playback logic for stable phrases and sentence boundaries

Dependencies:

- Task 4

Deliverables:

- commit manager
- chunking modes
- interruption-safe reset behavior

Done criteria:

- unstable trailing fragments never reach playback
- phrase and sentence commit modes are testable

## 8. Task 7: Cartesia TTS Path

Owner:

- backend integrations engineer

Goal:

- implement Cartesia WebSocket TTS for committed playback

Dependencies:

- Task 6

Deliverables:

- Cartesia client
- timestamp capture
- flush control

Done criteria:

- committed text becomes streamed audio
- `tts_first_audio` is recorded
- timestamps are available for the avatar

## 9. Task 8: Frontend Session Shell

Owner:

- frontend engineer

Goal:

- build the MVP session UI

Dependencies:

- Task 2

Deliverables:

- mic capture
- transcript panel
- tutor-state UI
- latency panel

Done criteria:

- user can run a full tutoring turn in browser
- session state is visible

## 10. Task 9: 2D Avatar Renderer

Owner:

- frontend / motion engineer

Goal:

- implement the client-side 2D avatar with speaking, listening, and thinking states

Dependencies:

- Tasks 7 and 8

Deliverables:

- avatar renderer
- mouth-shape system
- timestamp plus energy-driven animation

Done criteria:

- `first_viseme` can be measured
- avatar visibly tracks tutor playback
- states read clearly to an observer

## 24. Task 23: Avatar Catalog and Selector

Owner:

- frontend / product engineer

Goal:

- replace the current provider toggle with dropdown-driven avatar selection

Dependencies:

- Task 8
- Task 9

Deliverables:

- render-mode dropdown
- avatar dropdown
- manifest-backed catalog

Done criteria:

- reviewers can switch between multiple 2D and 3D avatars without code edits
- 2D remains the default baseline

## 25. Task 24: Local Avatar Assets and Placeholders

Owner:

- frontend / 3d pipeline engineer

Goal:

- support cheap local avatar testing with real assets and documented licenses

Dependencies:

- Task 23

Deliverables:

- local placeholder asset pack
- asset loader
- documented source/license notes

Done criteria:

- multiple avatars can be tested without paid providers
- broken assets degrade gracefully

## 26. Task 25: Lesson Session and Text Turns

Owner:

- frontend / backend realtime engineer

Goal:

- add explicit text-only turns, follow-up lesson flow, and new-lesson reset

Dependencies:

- Task 17
- Task 23

Deliverables:

- send-text action
- conversation history
- session reset

Done criteria:

- text-only use is obvious
- follow-up turns use history
- new lesson actually clears state

## 27. Task 26: Offline Avatar and Lesson Smoke Matrix

Owner:

- frontend / qa engineer

Goal:

- verify avatar/session UX in browser without spending credits

Dependencies:

- Task 23
- Task 24
- Task 25

Deliverables:

- fixture transport
- avatar matrix smoke suite
- text-lesson smoke
- new-lesson smoke

Done criteria:

- browser smoke runs with zero live provider credits
- 2D and 3D presets are covered

## 28. Task 27: Live Provider Benchmark Closure

Owner:

- backend / performance engineer

Goal:

- replace synthetic-only confidence with a bounded live benchmark pass

Dependencies:

- Task 3
- Task 7
- Task 16
- Task 26

Deliverables:

- live benchmark mode
- fixture vs live comparison
- pass/fail table against hard requirements

Done criteria:

- full required event set is measured with a live stack
- report clearly separates live and synthetic results

## 29. Task 28: Pedagogy, Demo, and Acceptance Pack

Owner:

- product / eval engineer

Goal:

- close multi-turn pedagogy proof and final submission evidence

Dependencies:

- Task 11
- Task 22
- Task 25
- Task 27

Deliverables:

- multi-turn eval set
- locked demo flow
- final acceptance checklist

Done criteria:

- demo shows lesson progression
- eval covers follow-up turns
- evidence maps to the hard requirements

## 30. Task 29: Provider Cost and Asset Licensing Guardrails

Owner:

- product / ops engineer

Goal:

- keep avatar experimentation cheap and legally safe

Dependencies:

- none

Deliverables:

- spend guardrails
- approved local asset list
- premium-provider usage rules
- attribution docs

Done criteria:

- local assets are the default test path
- premium avatar vendors are used only in explicit bakeoff lanes
- every shipped asset has source/license notes

## 31. Task 30: UI Polish and Usability Pass

Owner:

- frontend / product design engineer

Goal:

- make the tutor UI clearer, more usable, and demo-ready

Dependencies:

- Task 23
- Task 25
- Task 26

Deliverables:

- layout hierarchy cleanup
- CTA clarity for text, mic, interrupt, and new lesson
- history panel polish
- avatar selector polish
- mobile and accessibility pass
- better loading, empty, and error states

Done criteria:

- key lesson actions are obvious without explanation
- page works well on mobile and desktop
- keyboard and label/accessibility basics are solid
- UI is strong enough for reviewer/demo recording

## 32. Task 31: Interactive Lesson Artifacts

Owner:

- frontend / product / realtime engineer

Goal:

- add a dedicated artifact surface to `/session` so the tutor can teach with manipulable visuals such as fraction pizzas

Dependencies:

- Task 25
- Task 30

Deliverables:

- `LessonArtifactPanel` in `/session`
- first artifact: `fraction-pizza`
- guided lesson open mode where tutor can speak and seed the artifact immediately
- open-ended Socratic mode where artifact use is optional and tutor-led
- local artifact persistence in lesson thread state
- Yjs-ready artifact document path for later sync

Done criteria:

- a fractions lesson can open with tutor voice plus seeded artifact
- a learner can manipulate slices and continue the same tutor loop
- artifact state resumes with the lesson
- scope and product modes are reviewed before multiplayer work starts

Review note:

- this is not fully flushed and needs product + architecture review before implementation starts

## 11. Task 10: Audio Playback and Interruption

Owner:

- frontend / media engineer

Goal:

- implement playback buffering, fade-out, and interruption handling

Dependencies:

- Tasks 7, 8, and 9

Deliverables:

- audio player
- fade logic
- playback cancel path

Done criteria:

- interruption feels responsive
- queued audio is cut correctly
- avatar and audio stop together

## 12. Task 11: Pedagogy Eval Pack

Owner:

- product / prompt engineer

Goal:

- define fixed evaluation turns and rubric

Dependencies:

- PRD baseline

Deliverables:

- test turns
- rubric
- subject tracks

Done criteria:

- same eval set can be rerun consistently
- rubric covers Socratic quality and correctness

## 13. Task 12: Benchmark Report

Owner:

- backend / product engineer

Goal:

- turn raw benchmark runs into a decision report

Dependencies:

- Tasks 1 through 10

Deliverables:

- p50/p95 summary
- chunking recommendation
- avatar credibility note
- go/no-go recommendation for stretch branches

Done criteria:

- report clearly states whether MVP baseline passes
- report clearly states whether any stretch branch should open

## 14. Task 13: Demo Flow

Owner:

- product engineer

Goal:

- define and stabilize the 1-5 minute demo path

Dependencies:

- Tasks 8, 9, 10, and 11

Deliverables:

- chosen concepts
- demo script
- operator notes

Done criteria:

- demo can be repeated with low setup friction
- demo shows clear learning arc and visible tutor states

## 15. Task 14: Stretch Branch Spike

Owner:

- tech lead or R&D engineer

Goal:

- test one higher-complexity branch only after MVP benchmark pass

Dependencies:

- Task 12 says go

Possible branches:

- photoreal avatar
- WebRTC transport
- richer rig

Done criteria:

- branch has measured result
- branch beats MVP baseline on a concrete metric or is rejected

## 16. Task 15: Browser Mic Streaming

Owner:

- frontend / realtime engineer

Goal:

- replace the toggle-only mic UI with real browser capture and audio chunk streaming

Dependencies:

- Tasks 02, 03, 08, and 10

Deliverables:

- browser mic permission flow
- live `audio.chunk` stream
- real `speech.end` trigger
- typed fallback debug path

Done criteria:

- user can complete a tutoring turn with the browser mic
- backend receives real audio chunks

## 17. Task 16: Frontend Latency and Sync Instrumentation

Owner:

- frontend / performance engineer

Goal:

- replace placeholder metrics with real frontend timing and sync events

Dependencies:

- Tasks 07, 09, 10, and 15

Deliverables:

- `first_viseme` capture
- `audio_done` capture
- live latency display
- benchmark-ready timing records

Done criteria:

- UI shows real latency values
- avatar and audio timing can be compared per run

## 18. Task 17: Session Context and Personalization

Owner:

- backend / product engineer

Goal:

- carry subject, grade band, history, and optional student pacing into the tutoring turn

Dependencies:

- Tasks 02, 04, and 08

Deliverables:

- session context contract
- prompt-builder inputs for history and preferences
- UI controls for subject and grade band

Done criteria:

- context survives across turns
- prompt path uses grade band and subject explicitly

## 19. Task 18: End-to-End Smoke Coverage

Owner:

- frontend / QA engineer

Goal:

- add repeatable browser-level smoke coverage for app load, demo turn, and interruption

Dependencies:

- Tasks 10, 15, 16, and 17

Deliverables:

- app-load smoke test
- demo-turn smoke test
- interruption smoke test

Done criteria:

- one command verifies the core browser loop
- failures localize frontend vs backend vs websocket issues

## 20. Task 19: Dev Startup and Env Contract

Owner:

- full-stack engineer

Goal:

- make local startup obvious and reproducible from docs alone

Dependencies:

- Tasks 15 and 18

Deliverables:

- env var docs
- startup script or command set
- smoke verification command

Done criteria:

- new contributor can run the app without source digging
- demo notes match actual startup

## 21. Task 20: Requirements Trace and Review

Owner:

- tech lead / product engineer

Goal:

- map each requirement to proof before demo or submission

Dependencies:

- Tasks 11, 12, 13, 18, and 19

Deliverables:

- requirement-to-evidence matrix
- open-gap list
- reviewer checklist

Done criteria:

- each core requirement points to code, tests, docs, or benchmark evidence
- missing scope is visible before launch

## 22. Task 21: Cost / Performance Note

Owner:

- backend / product engineer

Goal:

- document cost, performance, and complexity tradeoffs across the chosen MVP stack

Dependencies:

- Tasks 01, 04, 05, 07, and 12

Deliverables:

- cost/performance note
- provider tradeoff summary
- stretch-branch complexity note

Done criteria:

- requirement-level cost/performance tradeoff analysis exists
- demo reviewers can see why the MVP baseline was chosen

## 23. Task 22: Demo Recording and Submission Pack

Owner:

- product engineer

Goal:

- turn the working MVP into the required demo artifact bundle

Dependencies:

- Tasks 12, 13, 19, 20, and 21

Deliverables:

- 1-5 minute demo video
- benchmark summary bundle
- setup and limitation notes

Done criteria:

- demo video exists
- submission artifacts map cleanly to the rubric

## 16. Critical Path

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 6
6. Task 7
7. Task 8
8. Task 9
9. Task 10
10. Task 15
11. Task 16
12. Task 17
13. Task 18
14. Task 19
15. Task 11
16. Task 12
17. Task 20
18. Task 21
19. Task 13
20. Task 22

## 17. Final Direction

The MVP is not “build everything.”

The MVP is:

- prove the latency budget
- prove the visual tutor works
- prove the Socratic flow works
- only then open harder branches
