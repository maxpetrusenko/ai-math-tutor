# Benchmark Report V1

## Fixture Baseline Metadata

- Date: 2026-03-08
- Mode: `fixture`
- Scope: deterministic local benchmark harness
- Inputs: `backend/benchmarks/canned_prompts.json`
- Runs: 90 total, 30 per prompt

## Fixture Summary Latency Table

| Stage | Count | p50 ms | p95 ms | Min ms | Max ms | Failure Count |
|-------|------:|-------:|-------:|-------:|-------:|--------------:|
| `speech_end -> stt_final` | 90 | 110 | 120 | 100 | 120 | 0 |
| `stt_final -> llm_first_token` | 90 | 75 | 90 | 60 | 90 | 0 |
| `llm_first_token -> tts_first_audio` | 90 | 250 | 290 | 240 | 290 | 0 |
| `speech_end -> tts_first_audio` | 90 | 440 | 480 | 420 | 480 | 0 |

## Fixture Required Event Coverage

| Event | Captured Fixture |
| --- | --- |
| `speech_end` | 90 / 90 |
| `stt_partial_stable` | 0 / 90 |
| `stt_final` | 90 / 90 |
| `llm_first_token` | 90 / 90 |
| `tts_first_audio` | 90 / 90 |
| `first_viseme` | 0 / 90 |
| `audio_done` | 0 / 90 |

Fixture conclusion:

- first-audio timing gate passes
- full required event set does not pass in fixture mode
- sync-stage misses are explicit now, not buried

## Live Benchmark Metadata

- Date: 2026-03-10
- Mode: `live`
- Scope: executed live provider benchmark
- Harness entrypoint: `python -m backend.benchmarks.run_latency_benchmark`
- Runs: 3 total, 1 per prompt
- Stack: Deepgram `nova-2` STT, Gemini `gemini-2.5-flash` LLM, Cartesia `sonic-2` TTS
- Local key status on 2026-03-10: `DEEPGRAM_API_KEY`, `MINIMAX_API_KEY`, and `CARTESIA_API_KEY` present in `.env`; `GOOGLE_AI_API_KEY` is auto-mapped to `GEMINI_API_KEY` by the benchmark CLI
- Proxy notes:
  - `stt_partial_stable` currently uses the prerecorded Deepgram completion time as a bounded proxy
  - `first_viseme` currently uses `tts_first_audio` as the playback-start proxy
  - `audio_done` currently uses WAV duration from returned Cartesia audio bytes

## Live Benchmark Commands

```bash
# Fixture baseline with full required events in the harness
python -m backend.benchmarks.run_latency_benchmark --mode fixture --runs-per-prompt 30

# Live benchmark analysis from recorded event logs
python -m backend.benchmarks.run_latency_benchmark --mode live --event-log path/to/live-runs.json

# Save either mode to disk
python -m backend.benchmarks.run_latency_benchmark --mode fixture --output benchmark-results.json
```

## Live Summary Latency Table

| Stage | Count | p50 ms | p95 ms | Min ms | Max ms | Failure Count |
|-------|------:|-------:|-------:|-------:|-------:|--------------:|
| `speech_end -> stt_partial_stable` | 3 | 722.8 | 924.1 | 709.6 | 946.5 | 0 |
| `speech_end -> stt_final` | 3 | 722.8 | 924.1 | 709.6 | 946.5 | 3 |
| `stt_final -> llm_first_token` | 3 | 2420.3 | 2645.6 | 2162.9 | 2670.6 | 0 |
| `llm_first_token -> tts_first_audio` | 3 | 259.0 | 264.2 | 251.1 | 264.8 | 0 |
| `tts_first_audio -> first_viseme` | 3 | 0.0 | 0.0 | 0.0 | 0.0 | 0 |
| `speech_end -> tts_first_audio` | 3 | 3407.9 | 3829.3 | 3123.6 | 3876.1 | 3 |
| `speech_end -> first_viseme` | 3 | 3407.9 | 3829.3 | 3123.6 | 3876.1 | 0 |
| `speech_end -> audio_done` | 3 | 7587.5 | 12179.9 | 7173.3 | 12690.2 | 0 |

## Fixture vs Live Comparison

| Stage | Fixture p50 ms | Live p50 ms | Delta ms | Reviewer Note |
| --- | ---: | ---: | ---: | --- |
| `speech_end -> stt_final` | 110.0 | 722.8 | 612.8 | fails hard requirement live |
| `speech_end -> tts_first_audio` | 440.0 | 3407.9 | 2967.9 | fails hard requirement live |
| `speech_end -> first_viseme` | n/a | 3407.9 | n/a | live value uses playback-start proxy |
| `speech_end -> audio_done` | n/a | 7587.5 | n/a | live value uses WAV-duration proxy |

## Hard Requirement Pass / Fail

### Fixture

- `time_to_first_audio` p50 under 500 ms: pass
- `time_to_first_audio` p95 under 900 ms: pass
- `speech_end -> stt_final` p95 under 350 ms: pass
- full required event set captured: fail

### Live

- `time_to_first_audio` p50 under 500 ms: fail (`3407.9 ms`)
- `time_to_first_audio` p95 under 900 ms: fail (`3829.3 ms`)
- `speech_end -> stt_final` p95 under 350 ms: fail (`924.1 ms`)
- full required event set captured: pass, with explicit proxy stages

## Remaining Misses (Explicit)

1. `stt_partial_stable`, `first_viseme`, and `audio_done` are bounded live proxies in the benchmark runner, not native streamed frontend measurements yet.
2. Live stack still misses the hard latency budget by a wide margin.

## Chunking Decision Note

Current default stays on stable phrase commit.

Reason:
- Lowest visible latency in the current fake local loop
- Sentence mode remains available
- No unstable trailing fragments reached the TTS event path in tests

## Avatar Quality Note

- Avatar receives word timestamps from the current TTS event contract
- Browser shell renders `idle`, `listening`, `thinking`, and `speaking` states
- Frontend latency panel now exposes `tts -> viseme`, `speech -> viseme`, and `speech -> audio done`
- Mouth animation is currently timestamp and energy driven but still MVP-grade, not polished

## Pedagogy Summary

- Fixed eval fixtures cover math, science, and English
- Socratic scoring helpers reward question-led turns and penalize direct-answer leakage
- This is still heuristic evaluation, not human-scored tutoring performance

## Limitations

- Checked-in latency numbers are still fixture numbers, not a committed live provider sample
- The benchmark runner and the main session runtime now both call the live Deepgram/Gemini/Cartesia stack when keys are present, and the frontend can play returned provider audio bytes
- `stt_partial_stable`, `first_viseme`, and `audio_done` remain proxy measurements in the live benchmark path

## Branch Recommendation

Recommendation: stay on MVP baseline.

Task 14 status: no-go.

Reason:
- The harness closes the budget synthetically
- The repo now has a real live benchmark outcome for one low-cost public stack
- Live numbers miss the hard latency requirements by a wide margin
- Stretch work would be premature before live-provider measurements replace the mocked timing path
