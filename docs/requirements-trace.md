# Requirements Trace Matrix

## Overview

This document traces the hard latency requirements and key tutoring-behavior requirements from the original spec through to implementation status.

| ID | Requirement | Threshold | Source | Implementation | Status |
|----|-------------|-----------|--------|----------------|--------|
| LR-1 | `speech_end -> stt_final` p95 | < 350 ms | Task 03 spec | `latency_tracker.py` stage calculation | FAIL (`live`), PASS (`fixture`) |
| LR-2 | `speech_end -> tts_first_audio` p50 | < 500 ms | Task 03 spec | `latency_tracker.py` stage calculation | FAIL (`live`), PASS (`fixture`) |
| LR-3 | `speech_end -> tts_first_audio` p95 | < 900 ms | Task 03 spec | `latency_tracker.py` stage calculation | FAIL (`live`), PASS (`fixture`) |

## Tutoring Behavior Trace

| ID | Requirement | Source | Implementation | Status |
|----|-------------|--------|----------------|--------|
| TB-1 | Same-problem follow-up turns reuse session history | `requirements.md`, `PRD.md` | `backend/session/server.py`, `backend/llm/topic_shift.py` | PASS |
| TB-2 | Clear topic shifts start a fresh turn instead of inheriting stale context | `requirements.md`, `PRD.md` | `backend/llm/topic_shift.py`, `tests/session/test_session_topic_shift.py` | PASS |
| TB-3 | Shipped UX avoids hardcoded starter prompts | `requirements.md`, `PRD.md` | `frontend/components/TutorSession.tsx`, `frontend/components/TutorSessionComposer.test.tsx` | PASS |

## Event Trace Requirements

| Event | Required By | Captured In | Fixture Status | Live Status |
|-------|-------------|-------------|----------------|-------------|
| `speech_end` | All STT metrics | `session/server.py` | Yes | Yes |
| `stt_partial_stable` | Interim transcript | `deepgram_client.py` + live benchmark runner | No in checked-in fixture report | Yes, proxy from prerecorded completion |
| `stt_final` | STT latency | `deepgram_client.py` + live benchmark runner | Yes | Yes, measured with live Deepgram |
| `llm_first_token` | LLM latency | `gemini_fallback_client.py` + live benchmark runner | Yes | Yes, measured with live Gemini in runtime and benchmark paths |
| `tts_first_audio` | TTS latency | `cartesia_client.py` + live benchmark runner | Yes | Yes, measured with live Cartesia in runtime and benchmark paths |
| `first_viseme` | Avatar sync | `TutorSession.tsx` + `session_metrics.ts` + live benchmark runner | Surfaced in frontend latency UI | Yes, playback-start proxy in benchmark path |
| `audio_done` | Turn lifecycle | `TutorSession.tsx` + `session_metrics.ts` + live benchmark runner | Surfaced in frontend latency UI | Yes, WAV-duration proxy in benchmark path |

## Provider Implementation Status

| Provider | Type | Live Code | Test Coverage | API Key Variable |
|----------|------|-----------|---------------|------------------|
| Deepgram | STT | Yes (WebSocket + benchmark HTTP path) | Yes | `DEEPGRAM_API_KEY` |
| MiniMax | LLM | Stub fallback only | Yes | `MINIMAX_API_KEY` |
| Gemini | LLM | Yes in app runtime and benchmark CLI | Yes | `GEMINI_API_KEY` or `GOOGLE_AI_API_KEY` |
| Cartesia | TTS | Yes in app runtime and benchmark CLI | Yes | `CARTESIA_API_KEY` |
| MiniMax | TTS | No in app runtime | Yes | `MINIMAX_SPEECH_API_KEY` |

## Test Coverage

| Test File | Coverage | Type |
|-----------|----------|------|
| `backend/benchmarks/run_latency_benchmark.py` | Fixture CLI, live execution entrypoint, event-log analysis, comparison helpers | Unit |
| `backend/benchmarks/live_provider_benchmark.py` | Real live stack: Deepgram + Gemini + Cartesia | Integration |
| `tests/benchmarks/test_run_latency_benchmark.py` | Required event coverage + fixture/live comparison | Unit |
| `tests/benchmarks/test_live_provider_benchmark.py` | Gemini SSE parsing + WAV duration parsing | Unit |
| `tests/session/test_server.py` | Session flow | Integration |
| `tests/session/test_server_pipeline.py` | End-to-end | E2E |

## Gaps to Production

1. **Proxy Stages:** `stt_partial_stable`, `first_viseme`, and `audio_done` are still benchmark proxies, not native frontend-live captures
2. **Cost Controls:** no per-request spend limits in the benchmark CLI yet
3. **CI Integration:** live benchmarks are not automated in CI
4. **Performance Gap:** live stack misses the hard latency budget by a large margin

## Requirement Validation

### LR-1: `speech_end -> stt_final` p95 < 350 ms

- **Fixture Result:** 120 ms (PASS)
- **Live Result:** 924.1 ms p95 on 2026-03-10 (FAIL)
- **Validation Path:** `python -m backend.benchmarks.run_latency_benchmark --mode live --runs-per-prompt 1`

### LR-2: `speech_end -> tts_first_audio` p50 < 500 ms

- **Fixture Result:** 440 ms (PASS)
- **Live Result:** 3407.9 ms p50 on 2026-03-10 (FAIL)
- **Validation Path:** real live benchmark runner now exists

### LR-3: `speech_end -> tts_first_audio` p95 < 900 ms

- **Fixture Result:** 480 ms (PASS)
- **Live Result:** 3829.3 ms p95 on 2026-03-10 (FAIL)
- **Validation Path:** real live benchmark runner now exists

## Mitigation for Live Failures

If live benchmarks fail the hard requirements:

1. **Parallelization:** Start LLM prefetch during STT finalization
2. **Streaming TTS:** Begin TTS as soon as first tokens arrive (not full phrase)
3. **Provider Selection:** Use faster regional endpoints
4. **Budget Adjustment:** Re-evaluate thresholds based on pedagogy value vs cost

## References

- Task 03: Initial latency requirements
- Task 07: STT provider implementation
- Task 16: TTS provider implementation
- Task 26: Monitoring and tracking
- Task 27: Live provider benchmark (this task)
