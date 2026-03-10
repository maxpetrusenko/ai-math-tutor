# Task 27: Live Provider Benchmark Closure

## Goal

Prove the latency budget with a tiny live-provider run instead of synthetic-only confidence.

## Owner

Backend / performance engineer

## Depends On

- Task 03
- Task 07
- Task 16
- Task 26

## Planned Files

- `backend/benchmarks/`
- `docs/planning/benchmark-report-v1.md`
- `docs/requirements-trace.md`
- `frontend/components/LatencyMonitor.tsx`

## Deliverables

- live benchmark mode
- fixture vs live comparison
- hard-requirement pass/fail table
- reviewer-friendly latency evidence

## Done Criteria

- live run captures the full required event set
- at least one low-cost stack is measured end-to-end
- benchmark report clearly separates synthetic and live numbers
- remaining misses are explicit, not hidden

## Parallel

Do after offline smoke is stable so live spend stays minimal.
