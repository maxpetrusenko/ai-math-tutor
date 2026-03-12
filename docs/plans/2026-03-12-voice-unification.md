# Voice Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify tutor voice selection so `/session`, dashboard-launched sessions, resumed lessons, and future session entry points all use one modular voice source of truth.

**Architecture:** Today the app has two voice stacks: the socket pipeline and the OpenAI realtime pipeline. The bug is not "multiple supported providers"; the bug is that defaults and hydration rules differ across frontend state, backend defaults, and persisted lesson threads. The fix is to make voice selection explicit, persist it once, hydrate it deterministically before first turn, and treat alternate providers as opt-in runtime modes rather than hidden route-dependent behavior.

**Tech Stack:** Next.js 15, React 19, TypeScript, FastAPI, Playwright, Vitest, pytest

---

## Current Diagnosis

- Frontend runtime defaults currently point at `openai-realtime` in [runtime_options.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/lib/runtime_options.ts).
- Backend runtime defaults currently point at `gemini` + `cartesia` in [runtime_options.py](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/backend/session/runtime_options.py).
- [TutorSession.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/TutorSession.tsx) initializes local state from frontend hardcoded defaults, then later hydrates session preferences and possibly a persisted lesson thread.
- Persisted lesson threads store `llmProvider`, `llmModel`, `ttsProvider`, and `ttsModel`, so resumed sessions can sound different from a fresh session.
- Dashboard links themselves do not choose a special voice. The likely difference is hydration source: active thread or saved preferences versus a fresh direct `/session` entry.

## Intended End State

- One default tutor voice path for all new sessions.
- One explicit modular override path for alternate providers.
- No hidden voice differences based on entry page.
- Resumed lessons may keep their original provider only if product explicitly wants that; otherwise they migrate to the current default in a controlled way.
- Session UI exposes the actual active voice path clearly enough for debugging.

### Task 1: Lock product decision for default voice path

**Files:**
- Modify: [docs/requirements-trace.md](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/docs/requirements-trace.md)
- Modify: [README.md](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/README.md)
- Modify: [docs/STACK.md](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/docs/STACK.md)

**Step 1: Choose the canonical default**

Pick one of:
- `cartesia` voice path as default for all new sessions
- `openai-realtime` voice path as default for all new sessions

Given the user report and current docs, recommended default:
- keep `cartesia` as the default tutor voice
- keep `openai-realtime` as an explicit opt-in transport mode, not the silent default

**Step 2: Write the product rule**

Document:
- what the default voice is
- whether resumed lessons preserve old voice config
- whether imported historic threads are migrated or grandfathered

### Task 2: Remove split defaults between frontend and backend

**Files:**
- Modify: [frontend/lib/runtime_options.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/lib/runtime_options.ts)
- Modify: [backend/session/runtime_options.py](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/backend/session/runtime_options.py)
- Test: [frontend/lib/runtime_options.test.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/lib/runtime_options.test.ts)
- Test: [tests/session/test_server_pipeline.py](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/tests/session/test_server_pipeline.py)

**Step 1: Write failing tests**

Add assertions that:
- frontend default TTS provider matches backend default TTS provider
- frontend default LLM and TTS pair normalize to the chosen canonical path

**Step 2: Introduce shared default contract**

Implement one of:
- frontend reads backend runtime defaults before first actionable turn
- or frontend constants are changed to match backend defaults and backend remains authoritative server-side

Recommended:
- backend remains authoritative
- frontend local defaults become temporary placeholders only
- session bootstrap replaces them from backend/session preferences before interaction starts

### Task 3: Make session bootstrap deterministic before first turn

**Files:**
- Modify: [frontend/components/TutorSession.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/TutorSession.tsx)
- Test: [frontend/components/TutorSession.test.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/TutorSession.test.tsx)
- Test: [frontend/components/TutorSession.transport.test.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/TutorSession.transport.test.tsx)

**Step 1: Write failing tests**

Cover:
- direct `/session` loads with hydrated default voice before first send
- dashboard-launched `/session` loads with the same voice
- active thread restore does not silently override the canonical default unless explicitly allowed

**Step 2: Gate first turn on resolved runtime**

Ensure the first send cannot happen until:
- session preferences restored
- thread policy applied
- runtime selection normalized

**Step 3: Prevent transient wrong-voice sends**

Current risk:
- component state starts at hardcoded defaults
- user can trigger a turn before final runtime source is resolved

Fix:
- use a `runtimeReady` gate or derive runtime from a resolved source object instead of from early `useState` defaults

### Task 4: Decide how persisted lessons handle voice drift

**Files:**
- Modify: [frontend/lib/lesson_thread_store.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/lib/lesson_thread_store.ts)
- Modify: [frontend/components/TutorSession.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/TutorSession.tsx)
- Test: [frontend/e2e/new-lesson.spec.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/e2e/new-lesson.spec.ts)
- Test: [frontend/components/TutorSession.test.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/TutorSession.test.tsx)

**Step 1: Pick policy**

Two sane options:
- preserve old thread voice for fidelity
- migrate old thread voice to current global default for consistency

Recommended:
- preserve historical metadata for audit/debug
- migrate playback defaults for resumed lessons unless the user explicitly pinned a custom provider

**Step 2: Encode policy**

Add a clear rule in restore flow:
- if thread provider equals an old implicit default, replace with current canonical default
- if thread provider was explicitly user-chosen, preserve it

### Task 5: Make modular overrides explicit in UI

**Files:**
- Modify: [frontend/app/models/page.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/app/models/page.tsx)
- Modify: [frontend/components/TutorSession.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/TutorSession.tsx)
- Modify: [frontend/components/TurnDebugPanel.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/TurnDebugPanel.tsx)
- Test: [frontend/app/page.test.tsx](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/app/page.test.tsx)

**Step 1: Clarify defaults page**

Models page should say:
- which voice is the app default
- which options are experimental or alternate

**Step 2: Clarify active session voice**

Session shell should expose:
- active transport
- active TTS provider
- active TTS model

No guessing from perceived audio quality.

### Task 6: Add regression coverage for route parity

**Files:**
- Add/Modify: [frontend/e2e/app-load.spec.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/e2e/app-load.spec.ts)
- Add: [frontend/e2e/session-voice-parity.spec.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/e2e/session-voice-parity.spec.ts)
- Test: [frontend/lib/session_preferences.test.ts](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/lib/session_preferences.test.ts)

**Step 1: Add parity checks**

Browser test should verify:
- `/session` fresh load and dashboard-launched session show the same active provider pair
- direct send and dashboard send choose the same transport and TTS provider

**Step 2: Add storage migration test**

Unit test should verify old stored `openai-realtime` defaults migrate if product policy says they should.

### Task 7: Docs and migration note

**Files:**
- Modify: [README.md](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/README.md)
- Modify: [docs/ARCHITECTURE.md](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/docs/ARCHITECTURE.md)
- Modify: [docs/requirements-trace.md](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/docs/requirements-trace.md)
- Modify: [docs/demo-operator-notes.md](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/docs/demo-operator-notes.md)

**Step 1: Update source of truth**

Docs must state:
- default tutor voice
- alternate voice path
- whether thread resume preserves or migrates voice config

**Step 2: Add operator note**

Demo note should tell the operator exactly where to confirm the active voice path before recording.

## Verification

Run sequentially:

```bash
python3 -m pytest -q
cd frontend && pnpm verify
cd frontend && pnpm e2e
```

Add focused checks during implementation:

```bash
cd frontend && pnpm vitest run frontend/lib/runtime_options.test.ts
cd frontend && pnpm vitest run frontend/components/TutorSession.test.tsx
cd frontend && pnpm exec playwright test e2e/session-voice-parity.spec.ts
```

## Recommended Implementation Order

1. lock product policy for default voice
2. align frontend/backend defaults
3. fix session bootstrap and runtime readiness
4. handle persisted thread migration policy
5. expose active voice in session UI
6. add route parity tests
7. update docs

## Expected Result

After this change:
- a fresh `/session` and a dashboard-launched session sound the same
- voice differences only happen when intentionally selected
- the system stays modular because provider switching still exists, but it is explicit and debuggable instead of accidental
