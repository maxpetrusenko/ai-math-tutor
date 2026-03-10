# Task 01: Benchmark Harness

## Goal

Build the Phase 0 benchmark gate and reporting path.

## Owner

Backend / performance engineer

## Depends On

None

## Planned Files

- `backend/monitoring/latency_tracker.py`
- `backend/benchmarks/run_latency_benchmark.py`
- `backend/benchmarks/canned_prompts.json`
- `docs/planning/benchmark-results-template.md`

## Deliverables

- canonical latency event schema
- 30-run benchmark runner
- p50 and p95 aggregation
- pass / fail report template

## Done Criteria

- required events are captured
- 30-run batches execute
- kill criteria can be computed from output

## Parallel

Can run with Task 11 immediately.
