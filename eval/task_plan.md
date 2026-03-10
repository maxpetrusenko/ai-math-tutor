# Task Plan: Live AI Video Tutor MVP Execution

## Goal
Ship the documented MVP baseline from benchmark harness through demo flow, with Task 14 gated by benchmark-report results.

## Current Phase
Phase 7

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach
- [x] Create project structure plan
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Wave 0 Implementation
- [x] Task 01 benchmark harness
- [x] Task 11 pedagogy eval pack
- [x] Initial backend project skeleton and tests
- **Status:** complete

### Phase 4: Session Spine Through Playback
- [x] Tasks 02-10 in critical-path order
- [x] Keep interfaces stable before dependent work
- [x] Add tests and docs per phase
- **Status:** complete

### Phase 5: Reporting, Demo, Stretch Gate
- [x] Task 12 benchmark report
- [x] Task 13 demo flow
- [x] Task 14 only if Task 12 says go
- **Status:** complete

### Phase 6: Verification & Delivery
- [x] Run full gate
- [x] Document results and gaps
- [x] Deliver completion status to user
- **Status:** complete

### Phase 7: Requirements Coverage and Review Planning
- [x] Audit requirements against the current task set
- [x] Add missing tasks for requirement gaps
- [x] Add requirement trace, testing plan, and reviewer checklist
- [x] Refresh project-local skill manifests for the new task wave
- **Status:** complete

### Phase 8: Runtime Gap Closure for Tasks 15-19
- [x] Add backend session context persistence
- [x] Add persistent frontend session transport and event-derived timing
- [x] Add browser mic capture abstraction and UI controls
- [x] Add startup/env contract and browser smoke coverage
- [x] Verify Python, frontend, build, and browser gates
- **Status:** complete

## Key Questions
1. Can the repo’s greenfield scaffold close the latency and pedagogy evidence gates with a docs-first baseline?
2. What minimal shared contracts should be defined in Wave 0 so Tasks 02-10 do not thrash?
3. When Task 12 is complete, does it explicitly recommend opening Task 14?
4. Which requirement gaps still block a credible reviewer pass after Tasks 01-13?
5. Which remaining open work is packaging/review only versus runtime-critical?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Treat existing `docs/plans/*` baseline as approved design | `docs/tasks/README.md` says planning baseline accepted and the user supplied the execution order |
| Start with Wave 0 only in code | Repo is docs-only; benchmark and eval artifacts unblock the rest of the critical path |
| Use Python backend workspace first | Tasks 01 and 11 are backend/eval heavy and can be verified without frontend scaffolding |
| Use `python3 -m pytest` instead of bare `pytest` for local verification | The shell `pytest` entrypoint did not resolve the repo package path consistently in this environment |
| Keep Task 14 closed | `docs/planning/benchmark-report-v1.md` recommends no-go because current timings are synthetic, not live-provider measurements |
| Re-open planning after Task 13 | Requirement-level review showed remaining gaps in mic capture, live timing, startup reproducibility, and packaging |
| Close runtime-critical gaps before packaging work | Better to prove the app loop first, then finish reviewer artifacts and demo assets |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `docs:list` command missing | 1 | Proceeded with direct doc reads per repo guidance |

## Notes
- Keep Task 14 closed unless Task 12 report explicitly says go
- Re-read `docs/tasks/README.md` before opening new task waves
- Log every verification run in `progress.md`
- Use `docs/requirements-trace.md`, `docs/testing-plan.md`, and `docs/reviewer-checklist.md` as the next planning baseline
- Remaining open queue is mostly Tasks 20-22 plus a future real STT path that uses captured mic audio directly
