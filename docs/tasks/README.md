# Tasks

## Current Stage

Planning baseline accepted. Task area now tracks execution work for the MVP prototype.

Source docs:

- `docs/requirements.md`
- `docs/PRD.md`
- `docs/STACK.md`
- `docs/TTS.md`
- `docs/ARCHITECTURE.md`
- `docs/EVAL.md`
- `docs/TASKS.md`
- `docs/planning/implementation-plan-v5.md`

## MVP Task Index

1. [`01-benchmark-harness.md`](./01-benchmark-harness.md)
2. [`02-websocket-session-server.md`](./02-websocket-session-server.md)
3. [`03-deepgram-streaming-stt.md`](./03-deepgram-streaming-stt.md)
4. [`04-minimax-llm-path.md`](./04-minimax-llm-path.md)
5. [`05-gemini-fallback-path.md`](./05-gemini-fallback-path.md)
6. [`06-commit-manager.md`](./06-commit-manager.md)
7. [`07-cartesia-tts-path.md`](./07-cartesia-tts-path.md)
8. [`08-frontend-session-shell.md`](./08-frontend-session-shell.md)
9. [`09-2d-avatar-renderer.md`](./09-2d-avatar-renderer.md)
10. [`10-audio-playback-and-interruption.md`](./10-audio-playback-and-interruption.md)
11. [`11-pedagogy-eval-pack.md`](./11-pedagogy-eval-pack.md)
12. [`12-benchmark-report.md`](./12-benchmark-report.md)
13. [`13-demo-flow.md`](./13-demo-flow.md)
14. [`14-stretch-branch-spike.md`](./14-stretch-branch-spike.md)
15. [`15-browser-mic-streaming.md`](./15-browser-mic-streaming.md)
16. [`16-frontend-latency-sync-instrumentation.md`](./16-frontend-latency-sync-instrumentation.md)
17. [`17-session-context-and-personalization.md`](./17-session-context-and-personalization.md)
18. [`18-e2e-smoke-coverage.md`](./18-e2e-smoke-coverage.md)
19. [`19-dev-startup-env-contract.md`](./19-dev-startup-env-contract.md)
20. [`20-requirements-trace-review.md`](./20-requirements-trace-review.md)
21. [`21-cost-performance-note.md`](./21-cost-performance-note.md)
22. [`22-demo-recording-and-submission-pack.md`](./22-demo-recording-and-submission-pack.md)
23. [`23-avatar-catalog-and-selector.md`](./23-avatar-catalog-and-selector.md)
24. [`24-local-avatar-assets-and-placeholders.md`](./24-local-avatar-assets-and-placeholders.md)
25. [`25-lesson-session-and-text-turns.md`](./25-lesson-session-and-text-turns.md)
26. [`26-offline-avatar-and-lesson-smoke-matrix.md`](./26-offline-avatar-and-lesson-smoke-matrix.md)
27. [`27-live-provider-benchmark-closure.md`](./27-live-provider-benchmark-closure.md)
28. [`28-pedagogy-demo-and-acceptance-pack.md`](./28-pedagogy-demo-and-acceptance-pack.md)
29. [`29-provider-cost-and-asset-licensing-guardrails.md`](./29-provider-cost-and-asset-licensing-guardrails.md)

## Phase Mapping

- Phase 0: Tasks 1
- Phase 1: Tasks 2, 3
- Phase 2: Tasks 4, 5
- Phase 3: Tasks 6, 7
- Phase 4: Tasks 8, 9, 10
- Phase 5: Tasks 15, 16, 17
- Phase 6: Tasks 18, 19
- Phase 7: Tasks 11, 12, 20, 21
- Phase 8: Tasks 13, 22
- Phase 9: Tasks 14
- Phase 10: Tasks 23, 24, 25, 26, 27, 28, 29

## Parallelization

### Wave 0

- Task 1: Benchmark Harness
- Task 11: Pedagogy Eval Pack

These can start immediately.

### Wave 1

- Task 2: WebSocket Session Server
- Task 4: MiniMax LLM Path
- Task 8: Frontend Session Shell

Task 4 and Task 8 can begin once Task 2 interface shape is stable.

### Wave 2

- Task 3: Deepgram Streaming STT
- Task 5: Gemini Fallback Path
- Task 6: Commit Manager

Task 5 depends on Task 4. Task 6 depends on Task 4.

### Wave 3

- Task 7: Cartesia TTS Path
- Task 9: 2D Avatar Renderer

Task 9 needs Task 7 and Task 8.

### Wave 4

- Task 10: Audio Playback and Interruption
- Task 15: Browser Mic Streaming
- Task 16: Frontend Latency and Sync Instrumentation

Task 15 depends on the playback path being stable. Task 16 depends on real playback and avatar timing.

### Wave 5

- Task 17: Session Context and Personalization
- Task 18: End-to-End Smoke Coverage
- Task 19: Dev Startup and Env Contract

Task 18 and Task 19 should land before final benchmark and demo packaging.

### Wave 6

- Task 11: Pedagogy Eval Pack
- Task 12: Benchmark Report
- Task 20: Requirements Trace and Review
- Task 21: Cost / Performance Note

Task 20 should summarize evidence from tests, eval, benchmark, and startup docs.

### Wave 7

- Task 13: Demo Flow
- Task 22: Demo Recording and Submission Pack

Task 13 should start only after a usable end-to-end loop exists.

### Wave 8

- Task 14: Stretch Branch Spike

Only after the benchmark report says go.

### Wave 9

- Task 23: Avatar Catalog and Selector
- Task 25: Lesson Session and Text Turns

Freeze the selector and session-reset contracts first.

### Wave 10

- Task 24: Local Avatar Assets and Placeholders
- Task 26: Offline Avatar and Lesson Smoke Matrix

These should default to zero-credit local validation.

### Wave 11

- Task 27: Live Provider Benchmark Closure
- Task 28: Pedagogy, Demo, and Acceptance Pack

Task 28 can start fixtures early, but final lock waits on Task 27 evidence.

### Wave 12

- Task 29: Provider Cost and Asset Licensing Guardrails

Task 29 should land before any premium-avatar bakeoff or final demo packaging.

## Critical Path

`1 -> 2 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 10 -> 15 -> 16 -> 17 -> 18 -> 19 -> 11 -> 12 -> 20 -> 21 -> 13 -> 22`

Extended closure path:

`23 -> 24 -> 25 -> 26 -> 27 -> 28`

Cost guardrail lane:

`29`

## Rule

Do not open stretch tasks until the benchmark gate closes on the MVP baseline.
