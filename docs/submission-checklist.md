# Submission Checklist

Complete this checklist before submitting the Nerdy MVP.

## Code Quality

### Backend
- [ ] All tests pass: `python -m pytest -q` (54 tests)
- [ ] No lint errors
- [ ] Environment variables documented in `.env.example`
- [ ] Provider architecture complete with registry
- [ ] STT → LLM → TTS → Avatar pipeline working

### Frontend
- [ ] All tests pass: `pnpm test` (18 tests)
- [ ] Typecheck passes: `pnpm typecheck`
- [ ] Build succeeds: `pnpm build`
- [ ] No console errors during demo flow
- [ ] Avatar switching works (2D ↔ 3D)
- [ ] Lazy loading verified (bundle impact measured)

## Documentation

### Core Docs
- [ ] `README.md` - installation, startup, usage
- [ ] `docs/cost-performance.md` - provider choices, cost analysis
- [ ] `docs/requirements-trace.md` - complete with current status
- [ ] `docs/demo-script.md` - rehearsed and timed
- [ ] `docs/demo-operator-notes.md` - startup and recovery steps
- [ ] `docs/reviewer-checklist.md` - quality gates

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
- [ ] Avatar switching demonstrated (2D → 3D → 2D)
- [ ] Interruption demonstrated during speech
- [ ] All 3 subjects shown (Math, Science, English)
- [ ] Grade band change demonstrated

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
- [ ] Backend tests passing (54/54)
- [ ] Frontend tests passing (18/18)
- [ ] Typecheck passing (no TS errors)
- [ ] Build succeeds (production bundle)

### Manual Verification
- [ ] Full demo runs without errors
- [ ] Typed prompt works end-to-end
- [ ] Mic input works (if API keys configured)
- [ ] Subject switching works
- [ ] Grade band switching works
- [ ] Avatar switching works

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

- **Date**: 2025-03-10
- **Python tests**: 54 passing
- **Frontend tests**: 18 passing
- **Typecheck**: Passing
- **Build**: Success
