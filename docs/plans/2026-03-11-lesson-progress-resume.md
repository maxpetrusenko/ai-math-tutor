# Lesson Progress Resume Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add persisted lesson progress data so the session shows a simple lesson program, current task, and tutor-led next question when starting or resuming a lesson.

**Follow-on shipped:** Dashboard now consumes the persisted lesson thread store to surface active-lesson resume and archived-lesson resume entry points.

**Architecture:** Extend the persisted lesson thread with optional lesson-state metadata, seed that state from the lesson catalog, and render a compact lesson brief in the session shell. Resume flows should prefer stored next-question state so the tutor leads the interaction instead of waiting for an empty prompt.

**Tech Stack:** Next.js App Router, React, Vitest, Testing Library, existing lesson-thread persistence helpers.

---

### Task 1: Define lesson-state test coverage

**Files:**
- Modify: `frontend/lib/lesson_catalog.test.ts`
- Modify: `frontend/components/TutorSession.test.tsx`
- Modify: `frontend/components/TutorSessionShell.test.tsx`

**Step 1: Write the failing tests**

- Add a helper-level test that resolves a lesson program/current task/next question from a lesson id.
- Add a session test that opening `/session?lesson=<id>` shows lesson title, step status, current task, and seeded next question.
- Add a session restore test that a persisted thread with lesson-state metadata renders the resume question/task instead of the blank welcome.

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --dir frontend vitest run frontend/lib/lesson_catalog.test.ts frontend/components/TutorSessionShell.test.tsx frontend/components/TutorSession.test.tsx
```

Expected:

- FAIL on missing lesson-state helpers or missing UI text

**Step 3: Write minimal implementation**

- Add lesson-state resolver helpers.
- Thread lesson-state through `TutorSession`.

**Step 4: Run tests to verify they pass**

Run the same command.

**Step 5: Commit**

```bash
git add frontend/lib/lesson_catalog.test.ts frontend/components/TutorSessionShell.test.tsx frontend/components/TutorSession.test.tsx frontend/lib/lesson_catalog.ts frontend/components/TutorSession.tsx frontend/lib/lesson_thread_store.ts
git commit -m "feat: add persisted lesson progress state"
```

### Task 2: Extend persisted lesson-thread model safely

**Files:**
- Modify: `frontend/lib/lesson_thread_store.ts`
- Modify: `frontend/lib/lesson_thread_api.ts` if type imports need updates only
- Modify: `frontend/lib/firebase_lessons.ts` if type imports need updates only

**Step 1: Write the failing test**

- Add coverage that legacy threads without `lessonState` still normalize.
- Add coverage that new threads preserve `lessonState`.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir frontend vitest run frontend/lib/lesson_thread_store.test.ts
```

Expected:

- FAIL because lesson-state fields are dropped or unsupported

**Step 3: Write minimal implementation**

- Extend `PersistedLessonThread` with optional `lessonState`
- Normalize and preserve the new object without breaking older threads

**Step 4: Run test to verify it passes**

Run the same command.

**Step 5: Commit**

```bash
git add frontend/lib/lesson_thread_store.ts frontend/lib/lesson_thread_store.test.ts
git commit -m "feat: persist lesson state in lesson threads"
```

### Task 3: Render the lesson brief in session UI

**Files:**
- Modify: `frontend/components/TutorSession.tsx`
- Modify: `frontend/app/globals.css`

**Step 1: Write the failing test**

- Assert the session shell renders lesson title, current task, and step status for seeded or restored lesson state.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir frontend vitest run frontend/components/TutorSessionShell.test.tsx
```

Expected:

- FAIL on missing lesson brief UI

**Step 3: Write minimal implementation**

- Add a compact lesson brief block inside the session shell
- Keep the current tutor-first layout

**Step 4: Run test to verify it passes**

Run the same command.

**Step 5: Commit**

```bash
git add frontend/components/TutorSession.tsx frontend/app/globals.css frontend/components/TutorSessionShell.test.tsx
git commit -m "feat: show lesson brief in session shell"
```

### Task 4: Make tutor resume copy lead with the next question

**Files:**
- Modify: `frontend/components/TutorSession.tsx`
- Modify: `frontend/lib/lesson_catalog.ts`
- Modify: `frontend/components/TutorSession.test.tsx`

**Step 1: Write the failing test**

- Assert that when lesson state exists, the visible tutor-led copy uses stored or derived next-question text.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir frontend vitest run frontend/components/TutorSession.test.tsx
```

Expected:

- FAIL because session still shows generic welcome copy

**Step 3: Write minimal implementation**

- Prefer `lessonState.nextQuestion` in the session welcome/resume content
- Fall back to a derived question from the current task

**Step 4: Run test to verify it passes**

Run the same command.

**Step 5: Commit**

```bash
git add frontend/components/TutorSession.tsx frontend/lib/lesson_catalog.ts frontend/components/TutorSession.test.tsx
git commit -m "feat: resume lessons with next question"
```

### Task 5: Final verification and doc refresh

**Files:**
- Modify: `docs/radiant-lessons-hub-page-review.md`
- Modify: `docs/plans/2026-03-11-lesson-progress-resume-design.md` if implementation details shift

**Step 1: Run focused tests**

```bash
pnpm --dir frontend vitest run frontend/lib/lesson_catalog.test.ts frontend/lib/lesson_thread_store.test.ts frontend/components/TutorSessionShell.test.tsx frontend/components/TutorSession.test.tsx
```

**Step 2: Run frontend gate**

```bash
pnpm --dir frontend test
pnpm --dir frontend typecheck
```

**Step 3: Refresh docs**

- Note that learning data now exists through persisted lesson state
- Call out remaining gap if analytics/dashboard reporting is still mocked

**Step 4: Commit**

```bash
git add docs/radiant-lessons-hub-page-review.md docs/plans/2026-03-11-lesson-progress-resume-design.md docs/plans/2026-03-11-lesson-progress-resume.md
git commit -m "docs: add lesson progress resume plan"
```
