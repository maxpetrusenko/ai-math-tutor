# Requirements Trace Matrix

Last updated: 2026-03-12

## Completion Read

Current state:

- engineering acceptance lane: complete
- backend tests: green
- frontend verify gate: green
- browser smoke gate: green
- visible lip-sync regression: green
- manual recording artifact: still manual

Current acceptance lane:

- shipped runtime fast path: live Deepgram streaming STT + local draft-policy tutor brain + live Cartesia TTS
- comparison lane: public-provider bakeoff with Deepgram + Gemini + Cartesia
- fixture lane: deterministic browser-safe rehearsal path

## Verified Commands

Fresh verification from 2026-03-12:

```bash
python3 -m pytest -q
cd frontend && pnpm verify
cd frontend && pnpm e2e
```

Observed results:

- `174 passed` in backend pytest
- `35` frontend test files, `128` frontend tests passed
- production build passed
- typecheck passed
- `10` Playwright specs passed

## Hard Latency Requirements

| ID | Requirement | Threshold | Current status |
| --- | --- | --- | --- |
| LR-1 | `speech_end -> stt_final` p95 | `< 350 ms` | PASS in runtime lane: `112.23 ms` p95 on 2026-03-11 |
| LR-2 | `speech_end -> tts_first_audio` p50 | `< 500 ms` | PASS in runtime lane: `363.6 ms` p50 on 2026-03-11 |
| LR-3 | `speech_end -> tts_first_audio` p95 | `< 900 ms` | PASS in runtime lane: `658.97 ms` p95 on 2026-03-11 |

Public stack note:

- public Deepgram + Gemini + Cartesia lane still fails the hard budget
- this remains comparison evidence, not the acceptance lane

## Product Behavior Trace

| ID | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| TB-1 | same-problem follow-up turns reuse context | [test_server_pipeline.py](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/tests/session/test_server_pipeline.py), [test_session_topic_shift.py](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/tests/session/test_session_topic_shift.py) | PASS |
| TB-2 | clear topic shifts stop dragging stale context | [test_session_topic_shift.py](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/tests/session/test_session_topic_shift.py) | PASS |
| TB-3 | shipped UX avoids hardcoded starter prompts | [TutorSession.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/TutorSession.tsx), [TutorSessionComposer.test.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/TutorSessionComposer.test.tsx) | PASS |
| TB-4 | interruption is immediate enough for conversation | [interrupt.spec.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/e2e/interrupt.spec.ts) | PASS |
| TB-5 | archived lesson continuity survives reload | [new-lesson.spec.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/e2e/new-lesson.spec.ts) | PASS |

## Avatar / Lip-Sync Trace

| ID | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| AV-1 | avatar visibly enters speaking state | [AvatarRenderer.test.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/AvatarRenderer.test.tsx), [TutorSession.test.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/TutorSession.test.tsx) | PASS |
| AV-2 | default SVG tutor exposes measurable mouth movement | [AvatarProvider.test.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/AvatarProvider.test.tsx), [avatar-lipsync.spec.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/e2e/avatar-lipsync.spec.ts) | PASS |
| AV-3 | 2D / 3D avatar switching works in browser | [avatar-mode-toggle.spec.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/e2e/avatar-mode-toggle.spec.ts), [avatar-provider.spec.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/e2e/avatar-provider.spec.ts) | PASS |

## Browser Flow Trace

| ID | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| UX-1 | session shell loads with core controls | [app-load.spec.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/e2e/app-load.spec.ts) | PASS |
| UX-2 | text turn works end to end in fixture mode | [text-lesson.spec.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/e2e/text-lesson.spec.ts) | PASS |
| UX-3 | demo turn streams readable tutor output | [demo-turn.spec.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/e2e/demo-turn.spec.ts) | PASS |
| UX-4 | new lesson resets thread cleanly | [new-lesson.spec.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/e2e/new-lesson.spec.ts) | PASS |

## Documentation / Packaging Trace

| ID | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| DOC-1 | runnable local startup docs exist | [README.md](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/README.md), [demo-operator-notes.md](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/docs/demo-operator-notes.md) | PASS |
| DOC-2 | demo script matches current UI | [demo-script.md](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/docs/demo-script.md), [script-demo.md](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/docs/script-demo.md) | PASS |
| DOC-3 | completion summary exists for handoff | [post.md](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/docs/post.md) | PASS |
| DOC-4 | final demo video artifact exists | manual recording only | OPEN |

## Honest Open Items

These are the remaining non-engineering gaps:

1. final recorded demo video is not committed in repo
2. public-provider bakeoff still misses hard latency budget
3. benchmark runner still uses proxy `first_viseme` / `audio_done` in benchmark mode even though the shipped browser path now verifies visible mouth motion

## Acceptance Call

If the question is "is the app and its testable demo path done?" the answer is yes.  
If the question is "is every submission artifact including the recorded video already packaged?" the answer is not yet.
