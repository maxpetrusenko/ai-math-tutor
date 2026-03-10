# Findings & Decisions

## Requirements
- Build the MVP task stack defined in `docs/tasks/README.md`
- Follow the user-provided execution order: start Task 01 and Task 11 immediately, then move along the critical path
- Hold Task 14 until Task 12 benchmark report explicitly clears it
- Preserve the locked baseline: FastAPI backend, WebSocket transport, Deepgram STT, MiniMax primary LLM, Gemini fallback, Cartesia TTS, client-side 2D avatar
- Meet the key evidence gates in `docs/requirements.md` and `docs/EVAL.md`

## Research Findings
- Repo currently contains docs and images only; no backend, frontend, or test scaffold exists yet
- `docs/tasks/README.md` marks the planning baseline as accepted and maps the 14 tasks into waves and a critical path
- `docs/plans/2026-03-08-live-ai-video-tutor-design.md` locks the MVP design and keeps stretch branches deferred
- `docs/plans/2026-03-08-live-ai-video-tutor-phase-plan.md` already defines phase gates and ownership areas
- Task 01 planned files: `backend/monitoring/latency_tracker.py`, `backend/benchmarks/run_latency_benchmark.py`, `backend/benchmarks/canned_prompts.json`, `docs/planning/benchmark-results-template.md`
- Task 11 planned files: `eval/test_turns.json`, `eval/rubric.md`, `eval/socratic_checks.py`
- Wave 0 is now implemented and verified locally with `python3 -m pytest -q` passing `13` tests
- Task 02 is the next hard blocker because Tasks 03, 04, and 08 depend on its interface shape
- Backend critical path now exists end-to-end in local code: session websocket, transcript commit path, prompt/policy layer, provider switch, committed TTS path, and timestamped audio events
- Frontend Next.js shell now includes session state, mic control, latency cards, avatar panel, and audio interruption UI
- Benchmark report exists, but it intentionally keeps Task 14 closed because current latency numbers are synthetic
- Requirement-gap follow-up added Tasks 15 through 22 for mic streaming, real frontend timing, context/history, browser smoke coverage, startup/env contract, requirements review, cost/performance notes, and demo packaging
- Requirement coverage is now mapped explicitly in `docs/requirements-trace.md`
- Verification expectations are now mapped explicitly in `docs/testing-plan.md`
- Review checkpoints are now collected in `docs/reviewer-checklist.md`
- Session transport now keeps a live WebSocket open across turns so backend history and profile state can persist
- Browser mic capture now records real chunks, but transcript content still falls back to the prompt textarea because the STT path remains synthetic
- Startup and browser smoke now run through `scripts/dev.sh` plus Playwright on isolated ports `8010` and `3010`

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Establish project structure under `backend/`, `eval/`, `tests/`, then add frontend later | Matches architecture docs and lets Wave 0 land with minimal thrash |
| Use TDD for each new behavior | Required by project instructions and fits greenfield code |
| Build benchmark/event contracts before session server | Task 02 and later tasks depend on stable timing/event semantics |
| Keep early runtime pure-Python and provider-agnostic | Lets core session logic be tested without live API credentials |
| Use `pnpm` for the new frontend workspace | No frontend package manager existed; `pnpm` was available locally and works well with Next.js |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| No existing package manager or app scaffold | Plan to introduce minimal Python workspace first, then extend when frontend/server tasks begin |
| Bare `pytest` did not import repo packages consistently | Standardized on `python3 -m pytest` for verification |
| Next.js build initially warned about workspace root detection | Added `frontend/next.config.ts` with `outputFileTracingRoot` |
| Next.js reset TS JSX handling during build | Added explicit `React` imports in frontend component and test files used by Vitest |

## Resources
- `docs/tasks/README.md`
- `docs/plans/2026-03-08-live-ai-video-tutor-design.md`
- `docs/plans/2026-03-08-live-ai-video-tutor-phase-plan.md`
- `docs/requirements.md`
- `docs/STACK.md`
- `docs/EVAL.md`

## Visual/Browser Findings
- No browser/image-specific findings used yet

## Planning Follow-up
- Existing planning docs claimed MVP completion too early relative to requirement-level proof
- New task wave focuses on closing real-world gaps rather than adding stretch scope
- Tasks 15 through 19 now have working code paths and verification hooks
- Tasks 20 through 22 remain packaging and review work, not core runtime blockers
