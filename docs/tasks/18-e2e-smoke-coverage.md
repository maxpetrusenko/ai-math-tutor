# Task 18: End-to-End Smoke Coverage

## Goal

Add repeatable browser-level smoke coverage for the runnable demo path.

## Owner

Frontend / QA engineer

## Depends On

- Task 10
- Task 15
- Task 16
- Task 17

## Planned Files

- `frontend/playwright.config.ts`
- `frontend/e2e/app-load.spec.ts`
- `frontend/e2e/demo-turn.spec.ts`
- `frontend/e2e/interrupt.spec.ts`

## Deliverables

- app-load smoke test
- full demo-turn smoke test
- interruption smoke test
- CI-friendly local run command

## Done Criteria

- one command can verify app load and core browser loop
- failure output points to frontend vs backend vs websocket issues
- smoke suite can run without manual clicking

## Parallel

After the browser loop is real, not mocked.
