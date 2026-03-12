# Session Tutor Port Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `/session` visually match the approved `/tutor` page while keeping Nerdy's real avatar and session behavior, with setup moved to dedicated pages.

**Architecture:** Replace the old tutor rail layout inside `TutorSession` with a centered session composition inside the shared app shell. Keep existing state and transport logic intact, remove inline setup controls, and hydrate new-session defaults from dedicated lesson, avatar, model, and settings pages.

**Tech Stack:** Next.js app router, React, Vitest, Testing Library, existing CSS variables, lucide-react

## Status

- Complete
- Implemented in the served repo on `main`
- Verified with focused session tests and full frontend gate

---

### Task 1: Lock the New Shell with a Failing Test

**Files:**
- Create: `frontend/components/TutorSessionShell.test.tsx`
- Modify: `frontend/components/TutorSession.test.tsx`

**Steps:**
1. Add a new shell test that asserts the new `/tutor` style page copy and structure.
2. Run only that test and confirm it fails against the old rail layout.

**Result:** Completed with `frontend/components/TutorSessionShell.test.tsx`.

### Task 2: Rebuild `TutorSession` Layout

**Files:**
- Modify: `frontend/components/TutorSession.tsx`
- Modify: `frontend/app/globals.css`

**Steps:**
1. Keep existing state and transport logic unchanged.
2. Replace the old full-height rail markup with the approved session studio structure.
3. Use `AvatarProvider` as the hero avatar surface.
4. Render conversation turns as chat bubbles in the main studio.
5. Keep only stage, chat, composer, and history on `/session`.
6. Keep history restore and resume buttons working.

**Result:** Completed in `frontend/components/TutorSession.tsx` and `frontend/app/globals.css`.
Refined after live review to use dedicated setup pages instead of inline settings.

### Task 3: Persist Setup Across Dedicated Pages

**Files:**
- Create: `frontend/lib/session_preferences.ts`
- Modify: `frontend/app/lessons/page.tsx`
- Modify: `frontend/app/avatar/page.tsx`
- Modify: `frontend/app/models/page.tsx`
- Modify: `frontend/app/settings/page.tsx`

**Steps:**
1. Add shared client-side storage for lesson, runtime, and audio defaults.
2. Write defaults from the dedicated setup pages.
3. Hydrate those defaults in fresh sessions.

**Result:** Completed with shared preference hydration across `/session`, `/lessons`, `/avatar`, `/models`, and `/settings`.

### Task 4: Stabilize Existing Behavior Tests

**Files:**
- Modify: `frontend/components/TutorSession.test.tsx`
- Modify: `frontend/components/TutorSessionComposer.test.tsx`

**Steps:**
1. Update selector assumptions for the stage-only shell.
2. Reset localStorage and persisted lesson state between tests so suites stay deterministic.
3. Preserve assertions for runtime selection, mic flow, persistence, avatar restore, and history.

**Result:** Completed.

### Task 5: Verify and Document

**Files:**
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`

**Steps:**
1. Run targeted tutor tests.
2. Run `pnpm verify` in `frontend/`.
3. Record the visual port and verification results in task files.

**Result:** Completed.

## Verification

- `pnpm vitest run components/TutorSessionShell.test.tsx`
- `pnpm vitest run lib/session_preferences.test.ts components/TutorSessionShell.test.tsx components/TutorSessionComposer.test.tsx components/TutorSession.test.tsx`
- `pnpm vitest run components/AudioPlayer.test.tsx`
- `pnpm verify`
