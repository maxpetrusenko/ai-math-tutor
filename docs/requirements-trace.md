# Requirements Trace

Maps each requirement to implementation tasks, evidence, and review focus.

Supporting docs:

- `docs/testing-plan.md`
- `docs/reviewer-checklist.md`
- `docs/cost-performance.md`

## Latency

| ID | Requirement | Tasks | Evidence / Tests | Review |
| --- | --- | --- | --- | --- |
| L1 | End-to-end response under `1s` | 1, 7, 10, 12, 16 | benchmark runner, benchmark report, live timing UI | review p50 and p95, not one-off wins |
| L2 | Ideal end-to-end under `500ms` | 1, 12, 16, 21 | benchmark report trend line | review whether ideal bar is real or synthetic |
| L3 | First audio under `500ms` | 6, 7, 10, 12, 16 | TTS timing events, benchmark report | review commit mode and first audio path |
| L4 | Lip-sync within `+/-80ms` | 7, 9, 10, 16, 12 | avatar timing tests, sync instrumentation | review visible sync by eye and metric |
| L5 | Full response under `3s` | 4, 6, 7, 10, 12 | benchmark runs, response policy tests | review long-turn behavior |
| L6 | Per-stage latency measurement | 1, 12, 16 | latency tracker tests, live UI metrics | review missing frontend events |
| L7 | Full pipeline streaming, not sequential | 2, 3, 4, 6, 7, 15 | session pipeline tests, demo-turn smoke | review any fake batching or hard-coded delays |

## Video Interaction

| ID | Requirement | Tasks | Evidence / Tests | Review |
| --- | --- | --- | --- | --- |
| V1 | Video-based tutor interaction | 8, 9, 13, 22 | runnable UI, demo video | review whether it reads as a tutor, not a panel demo |
| V2 | Voice input | 8, 15, 18 | browser mic smoke tests | review permission UX and browser support |
| V3 | Voice output | 7, 10, 18 | playback tests, demo-turn smoke | review interruption and queued audio behavior |
| V4 | Real-time avatar / visual tutor | 8, 9, 16 | avatar renderer tests, live UI | review state clarity: idle/listening/thinking/speaking |
| V5 | Smooth lip-sync | 7, 9, 16, 12 | avatar timing tests, benchmark note | review mouth motion quality by eye |
| V6 | Natural conversational flow | 4, 10, 13, 18 | prompt-policy tests, smoke flow | review pause length and interruption feel |

### Avatar Implementation (NEW)

| ID | Feature | Implementation | Evidence | Review |
| --- | --- | --- | --- | --- |
| V4.1 | 2D CSS avatar | `AvatarRenderer.tsx` | component tests, visual review | review state transitions |
| V4.2 | 3D Three.js avatar | `Avatar3D.tsx` (lazy-loaded) | typecheck, render loop correctness | review 3D rendering quality |
| V4.3 | Provider switching | `backend/providers/avatar/*` | registry tests, UI toggle | review switching hot-reloads correctly |
| V4.4 | Lip-sync (2D) | `getMouthOpenAmount()` | avatar timing tests | review vowel/consonant weighting |
| V4.5 | Lip-sync (3D) | render loop reads timestamps | visual review, state refresh | review mouth motion matches timing |
| V5.1 | Stale props fix | refs for state/timestamps/nowMs/energy | regression avoided | review props flow correctly to render loop |
| V5.2 | Lazy loading | `next/dynamic` import | bundle size check, loading UI | review 2D path doesn't pay 3D cost |

## Educational Quality

| ID | Requirement | Tasks | Evidence / Tests | Review |
| --- | --- | --- | --- | --- |
| E1 | Ask guiding questions | 4, 11 | prompt policy tests, Socratic checks | review direct-answer leakage |
| E2 | Scaffold with smaller questions | 4, 11 | eval fixtures, scoring helpers | review whether follow-ups build logically |
| E3 | Adapt to student responses | 4, 17, 11 | prompt-builder tests, eval runs | review multi-turn behavior, not just first turn |
| E4 | Redirect wrong answers gently | 4, 11 | rubric, Socratic checks | review tone and correction style |
| E5 | Ask students to explain why when right | 4, 11 | eval set, scoring helpers | review strong-answer follow-up path |
| E6 | Grade-appropriate for `6-12` | 4, 17, 11 | prompt-builder tests, eval rubric | review grade-band controls in UI and prompt |
| E7 | Maintain subject correctness | 4, 11, 20 | eval runs, reviewer checklist | review domain correctness on demo concepts |
| E8 | Encouraging and engaging | 4, 11 | Socratic checks, demo script | review tone drift |
| E9 | Cover `1-3` concepts per session | 13, 22 | demo script, demo video | review concept scope in final demo |
| E10 | Clear learning arc in demo | 13, 22 | demo script, demo recording | review beginning, middle, end arc |
| E11 | Most tutor turns end with a question | 4, 11 | response policy tests, scoring helpers | review percentage across eval turns |

## Architecture and System

| ID | Requirement | Tasks | Evidence / Tests | Review |
| --- | --- | --- | --- | --- |
| A1 | Clear pipeline stages | 1, 2, 20 | architecture docs, requirement trace | review event and message boundaries |
| A2 | Efficient serving strategy | 2, 12, 21 | benchmark report, cost/perf note | review whether current baseline is enough for demo |
| A3 | Streaming architecture | 2, 3, 4, 7, 15 | pipeline tests, smoke tests | review no fake sync gaps |
| A4 | Benchmark hooks at every stage | 1, 12, 16 | latency tracker, benchmark report | review missing `first_viseme` / `audio_done` |
| A5 | Cost / performance tradeoff analysis | 21, 12 | cost/performance note | review whether provider choices are justified |

### Provider Architecture (NEW)

| ID | Feature | Implementation | Evidence | Review |
| --- | --- | --- | --- | --- |
| A1.1 | STT provider registry | `backend/providers/stt/*` | factory tests, Deepgram wrapper | review hot-swap works |
| A1.2 | LLM provider registry | `backend/providers/llm/*` | factory tests, MiniMax/Gemini wrappers | review fallback triggers correctly |
| A1.3 | TTS provider registry | `backend/providers/tts/*` | factory tests, Cartesia wrapper | review voice config merges |
| A1.4 | Avatar provider registry | `backend/providers/avatar/*` | factory tests, Three.js provider | review 2D/3D switching |

## Inputs and Outputs

| ID | Requirement | Tasks | Evidence / Tests | Review |
| --- | --- | --- | --- | --- |
| IO1 | Text or audio student input | 8, 15, 18 | typed flow + mic smoke | review typed fallback and live mic both work |
| IO2 | Subject and grade-level context | 17 | prompt-builder and session tests | review UI affordance and prompt contract |
| IO3 | Conversation history | 17 | session pipeline tests | review multi-turn memory |
| IO4 | Student pacing / preferences when available | 17 | prompt-builder tests | review whether this is MVP or optional |
| IO5 | Streamed tutor text | 4, 6, 18 | session tests, smoke tests | review committed text path |
| IO6 | Synthesized tutor voice | 7, 10, 18 | playback tests, smoke tests | review audio artifact rate |
| IO7 | Avatar / video output | 9, 16, 22 | UI proof, demo video | review final visual quality |
| IO8 | Optional diagrams / visual aids | deferred | none yet | decide if truly optional for MVP |
| IO9 | Latency and quality metrics | 1, 11, 12, 16, 20 | benchmark + eval docs | review whether metrics are reviewer-friendly |

### Audio Transport (NEW)

| ID | Feature | Implementation | Evidence | Review |
| --- | --- | --- | --- | --- |
| IO1.1 | Mic capture records bytes | `BrowserAudioCapture` | audio capture tests | review bytes_b64 populated |
| IO1.2 | Chunk shape with bytes_b64 | WebSocket message schema | session pipeline tests | review bytes sent over socket |
| IO1.3 | Typed prompt fallback | server.py message handling | typed turn smoke | review graceful fallback when no mic |

## Deliverables and Packaging

| ID | Requirement | Tasks | Evidence / Tests | Review |
| --- | --- | --- | --- | --- |
| P1 | Working low-latency prototype | 2 through 19 | unit, integration, smoke, manual run | review full loop on clean machine |
| P2 | Latency benchmarking framework | 1, 12 | benchmark tests and report | review synthetic vs live-provider gaps |
| P3 | Educational evaluation pack | 11, 20 | eval fixtures, rubric, scoring | review coverage across math/science/English |
| P4 | `1-5` minute demo video | 13, 22 | recorded artifact | review pacing and visual clarity |
| P5 | App runs from small setup | 19, 22 | README, startup script, smoke command | review from zero-context setup |
| P6 | README and usage docs | 19, 20, 22 | docs review | review exact commands and env vars |
| P7 | Explicit limitations and recommendations | 12, 21, 22 | benchmark report, cost/perf note | review honesty and next-step clarity |

## Test Status (2025-03-10)

### Backend
- **54 tests passing** (`pytest`)
- STT, LLM, TTS, session, metrics all covered
- Provider architecture fully tested

### Frontend
- **18 tests passing** (`pnpm test`)
- Avatar timing, playback, session metrics, audio capture covered
- AvatarRenderer, AudioPlayer, TutorSession components tested
- Avatar registry, driver, timing utilities tested

### Type Safety
- **typecheck passing** (`next typegen && tsc --noEmit`)
- Avatar contracts properly typed
- Provider interfaces defined

## Open Gaps Right Now

- ~~Browser mic capture records real chunks~~ ✅ FIXED - now sends bytes_b64
- ~~Frontend latency cards derive from session events~~ ✅ WORKING - event-driven metrics
- Reviewer-facing sync coverage still stops before `first_viseme` and `audio_done` surface
- ~~Cost / performance note is still implicit~~ ✅ CREATED - see `docs/cost-performance.md`
- Demo recording artifact does not exist yet
- Browser-level smoke coverage missing for mic permission flow (Lane B work)
- Session history and student preference inputs are thin (expected for MVP)

## Recent Updates (Lane A + D)

- ✅ Fixed 3D avatar stale props (refs for state/timestamps/nowMs/energy)
- ✅ Lazy-loaded Three.js bundle (2D default doesn't pay 3D cost)
- ✅ Provider architecture with registry pattern
- ✅ Cost-performance analysis documented
- ✅ Requirements trace updated for current implementation

## Review Queue

- [ ] Confirm whether typed prompt should remain as permanent demo fallback (currently works well)
- [ ] Decide whether student pacing or learning preferences are MVP or stretch (currently thin/optional)
- [ ] Confirm if optional diagrams stay deferred (currently deferred)
- [ ] Review the benchmark bar using live-provider timings, not only synthetic timings
- [ ] Review whether the 2D avatar is credible enough before any photoreal branch opens
- [ ] **NEW**: Verify lazy-loaded 3D avatar doesn't cause FOUC or janky loading state
