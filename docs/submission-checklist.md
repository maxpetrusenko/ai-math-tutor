# Submission Checklist

Complete this checklist before submitting the Nerdy MVP.

## Closure Lane Status

- [x] Lane A / Task 23 complete
- [x] Lane B / Task 24 complete
- [x] Lane C / Task 25 complete
- [x] Lane D / Task 26 complete
- [x] Lane E / Task 27 complete
- [x] Lane F / Task 28 complete
- [x] Lane G / Task 29 complete
- [x] Lane H / Task 30 complete

## Code Quality

### Backend
- [ ] All tests pass: `python -m pytest -q` (76 tests)
- [ ] No lint errors
- [ ] Environment variables documented in `.env.example`
- [ ] Provider architecture complete with registry
- [ ] STT → LLM → TTS → Avatar pipeline working

### Frontend
- [ ] All tests pass: `pnpm test` (53 tests)
- [ ] Typecheck passes: `pnpm typecheck`
- [ ] Build succeeds: `pnpm build`
- [ ] No console errors during demo flow
- [ ] Avatar switching works (2D ↔ 3D)
- [ ] Lazy loading verified (bundle impact measured)

## Documentation

### Core Docs
- [ ] `README.md` - installation, startup, usage
- [ ] `docs/cost-performance.md` - provider choices, cost analysis
- [ ] `docs/avatar-costs-and-licensing.md` - demo-safe asset policy
- [ ] `docs/requirements-trace.md` - complete with current status
- [ ] `docs/demo-script.md` - rehearsed and timed
- [ ] `docs/demo-operator-notes.md` - startup and recovery steps
- [ ] `docs/reviewer-checklist.md` - quality gates
- [ ] `docs/eval-summary.md` - multi-turn scorecard

### Supporting Docs
- [ ] `docs/ARCHITECTURE.md` - system design
- [ ] `docs/STACK.md` - technology choices
- [ ] `docs/TASKS.md` - task breakdown
- [ ] `docs/PRD.md` - product requirements
- [ ] `docs/EVAL.md` - evaluation approach
- [ ] `docs/testing-plan.md` - test strategy

## Functionality Verification

### Core Flow
- [ ] Student can type a prompt and get a response
- [ ] Student can use mic input (if configured)
- [ ] Tutor stays Socratic (asks questions, doesn't lecture)
- [ ] Latency is under 1 second end-to-end
- [ ] Avatar mouth syncs with speech
- [ ] Interruption works instantly

### Multi-Turn Session
- [ ] Conversation history persists across turns
- [ ] Tutor uses context from previous turns
- [ ] Follow-up questions advance understanding
- [ ] Learning arc visible across 3+ turns
- [ ] `New Lesson` button clears history properly

### Avatar and Provider Lock (Demo Day Configuration)
- [ ] Default avatar: `human-css-2d` (2D CSS human)
- [ ] Alternative avatars available: `human-threejs-3d`, `robot-css-2d`
- [ ] STT provider: Deepgram (production baseline)
- [ ] Primary LLM: MiniMax-M2.5
- [ ] Fallback LLM: Gemini 3.1 Flash-Lite Preview (eval only)
- [ ] Primary TTS: Cartesia Sonic-3
- [ ] Avatar providers: CSS (2D), Three.js (3D)

### Subject Coverage
- [ ] Math prompts work (algebra, solving for x)
- [ ] Science prompts work (photosynthesis, etc.)
- [ ] English prompts work (grammar, etc.)

### Grade Bands
- [ ] 6-8 grade band appropriate
- [ ] 9-10 grade band appropriate
- [ ] 11-12 grade band appropriate

### Avatar States
- [ ] `idle` state visible
- [ ] `listening` state visible
- [ ] `thinking` state visible
- [ ] `speaking` state visible
- [ ] Mouth animates during `speaking`
- [ ] Avatar returns to `idle` after completion

## Demo Readiness

### Setup
- [ ] App starts with one command: `bash scripts/dev.sh`
- [ ] Backend connects on `ws://localhost:8000/ws/session`
- [ ] Frontend loads on `http://localhost:3000`
- [ ] Connection state shows `connected`

### Demo Flow
- [ ] Rehearsed the demo script (4-5 minutes target)
- [ ] Avatar switching demonstrated (`human-css-2d` → `human-threejs-3d` → `robot-css-2d`)
- [ ] Interruption demonstrated during speech
- [ ] All 3 subjects shown (Math, Science, English)
- [ ] Grade band change demonstrated
- [ ] Multi-turn lesson arc shown before switching concepts

### Recording
- [ ] Demo video recorded (1-5 minutes)
- [ ] Video shows learning arc (intro → teaching → summary)
- [ ] Latency numbers visible in video
- [ ] Avatar lip-sync visible in video
- [ ] Narration explains key features

## Limitations Documented

### Known Limitations
- [ ] Single-session WebSocket (no horizontal scaling yet)
- [ ] Conversation history lost on refresh
- [ ] No persistent user accounts
- [ ] Mic input requires HTTPS for production
- [ ] TTS providers require API keys
- [ ] No visual aids/diagrams yet (deferred)

### Next Steps
- [ ] Scaling path documented (if needed)
- [ ] Provider swap process documented
- [ ] Cost projections included (see cost-performance.md)

## Test Evidence

### Automated Tests
- [ ] Backend tests passing (`76` current target)
- [ ] Frontend tests passing (`53` current frontend verify target)
- [ ] Typecheck passing (no TS errors)
- [ ] Build succeeds (production bundle)

### Multi-Turn Evaluation
- [ ] Math lesson fixture: `eval/fixtures/multi_turn/math-linear-equations.json`
- [ ] Science lesson fixture: `eval/fixtures/multi_turn/science_photosynthesis.json`
- [ ] English lesson fixture: `eval/fixtures/multi_turn/english_subject_verb.json`
- [ ] Socratic quality measured across follow-up turns
- [ ] Learning arc verified (diagnose → practice → verify → summarize)

### Manual Verification
- [ ] Full demo runs without errors
- [ ] Typed prompt works end-to-end
- [ ] Mic input works (if API keys configured)
- [ ] Subject switching works
- [ ] Grade band switching works
- [ ] Avatar switching works
- [ ] `New Lesson` clears transcript and tutor reply
- [ ] Conversation history proves lesson continuity

## Acceptance Evidence

- [ ] `docs/EVAL.md` updated with multi-turn scoring and locked presets
- [ ] `docs/eval-summary.md` linked in reviewer handoff
- [ ] `docs/demo-script.md` rehearsed against the locked concept order
- [ ] `docs/demo-operator-notes.md` updated with reset and preset notes
- [ ] Task 27 benchmark report linked once live numbers land
- [ ] Task 27 requirements-trace update linked once live numbers land

## Submission Package

### Files Included
- [ ] Source code (all `.py`, `.ts`, `.tsx` files)
- [ ] Documentation (all `.md` files)
- [ ] Configuration files (`.env.example`, `package.json`, etc.)
- [ ] Demo video (if applicable)
- [ ] Test results screenshot/output

### Files Excluded
- [ ] `.env` (contains API keys)
- [ ] `node_modules/`
- [ ] `__pycache__/`
- [ ] `.pytest_cache/`
- [ ] `.next/`
- [ ] Any other build artifacts

## Final Review

### Self-Assessment
- [ ] Reviewed against `docs/reviewer-checklist.md`
- [ ] All high-priority items addressed
- [ ] Product review items addressed
- [ ] UX review items addressed
- [ ] Technical review items addressed

### Peer Review
- [ ] Second person tested the demo
- [ ] Feedback incorporated
- [ ] Critical issues fixed

### Sign-Off
- [ ] All checklist items complete
- [ ] Ready for submission

## Quick Smoke Command

Run this to verify basic health before submitting:

```bash
# Backend
python -m pytest -q

# Frontend
cd frontend
pnpm test
pnpm typecheck

# All should pass
```

## Go/No-Go Criteria

**GO if:**
- All automated tests pass
- Demo runs smoothly
- Documentation is complete
- Latency is under 1 second
- Tutor stays Socratic

**NO-GO if:**
- Any test failing
- Demo crashes or errors
- Missing critical documentation
- Latency consistently over 1 second
- Tutor lectures instead of asking questions

## Version Info

- **Date**: 2026-03-10
- **Python tests**: `76` current target after Tasks 28-30
- **Frontend tests**: `53` current frontend verify target
- **Typecheck**: Passing
- **Build**: Success
