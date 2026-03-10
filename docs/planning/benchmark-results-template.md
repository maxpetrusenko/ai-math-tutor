# Benchmark Results

## Run Metadata

- Date:
- Commit:
- Environment:
- Runner:

## Raw Event Log

Attach or link the raw event output for each benchmark run.

## Summary Latency Table

| Stage | Count | p50 ms | p95 ms | Min ms | Max ms | Failure Count |
|-------|-------|--------|--------|--------|--------|---------------|

## Kill Criteria Check

- `time_to_first_audio` p50 under 500 ms:
- `time_to_first_audio` p95 under 900 ms:
- `speech_end -> stt_final` p95 under 350 ms:
- Stable repeated runs with no sync collapse:

## Chunking Decision Note

Document whether sentence, phrase, or word-level commit won the benchmark.

## Avatar Quality Note

Record first viseme timing, sync quality, and visible artifacts.

## Pedagogy Summary

Summarize rubric results for the sampled tutoring turns.

## Branch Recommendation

- Stay on MVP baseline
- Open Task 14 stretch branch
- Blocked pending bottleneck fixes
