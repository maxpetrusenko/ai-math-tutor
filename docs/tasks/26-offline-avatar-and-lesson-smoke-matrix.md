# Task 26: Offline Avatar and Lesson Smoke Matrix

## Goal

Cover the new avatar and lesson UX in browser smoke tests without paid-provider spend.

## Owner

Frontend / QA engineer

## Depends On

- Task 23
- Task 24
- Task 25

## Planned Files

- `frontend/lib/fixture_transport.ts`
- `frontend/playwright.config.ts`
- `frontend/e2e/avatar-matrix.spec.ts`
- `frontend/e2e/text-lesson.spec.ts`
- `frontend/e2e/new-lesson.spec.ts`

## Deliverables

- fixture transport mode
- avatar matrix smoke suite
- text-only lesson smoke
- new-lesson reset smoke

## Done Criteria

- browser smoke can run with zero live provider credits
- 2D and 3D presets are covered by automated tests
- failure output makes asset vs UI vs session issues clear
- screenshots/video can be reused for reviewer evidence

## Parallel

After the selector and lesson UX contracts are stable.
