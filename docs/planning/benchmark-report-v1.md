# Benchmark Report V1

## Run Metadata

- Date: 2026-03-08
- Scope: synthetic local MVP baseline harness
- Inputs: `backend/benchmarks/canned_prompts.json`
- Runs: 90 total, 30 per prompt

## Summary Latency Table

| Stage | Count | p50 ms | p95 ms | Min ms | Max ms | Failure Count |
|-------|------:|-------:|-------:|-------:|-------:|--------------:|
| `speech_end -> stt_final` | 90 | 110 | 120 | 100 | 120 | 0 |
| `stt_final -> llm_first_token` | 90 | 75 | 90 | 60 | 90 | 0 |
| `llm_first_token -> tts_first_audio` | 90 | 250 | 290 | 240 | 290 | 0 |
| `speech_end -> tts_first_audio` | 90 | 440 | 480 | 420 | 480 | 0 |

## Kill Criteria Check

- `time_to_first_audio` p50 under 500 ms: pass
- `time_to_first_audio` p95 under 900 ms: pass
- `speech_end -> stt_final` p95 under 350 ms: pass
- Stable repeated runs with no sync collapse: pass in synthetic harness

## Chunking Decision Note

Current default stays on stable phrase commit.

Reason:

- lowest visible latency in the current fake local loop
- sentence mode remains available
- no unstable trailing fragments reached the TTS event path in tests

## Avatar Quality Note

- Avatar receives word timestamps from the current TTS event contract
- Browser shell renders `idle`, `listening`, `thinking`, and `speaking` states
- Mouth animation is currently timestamp and energy driven but still MVP-grade, not polished

## Pedagogy Summary

- Fixed eval fixtures cover math, science, and English
- Socratic scoring helpers reward question-led turns and penalize direct-answer leakage
- This is still heuristic evaluation, not human-scored tutoring performance

## Limitations

- Current benchmark numbers come from the deterministic local harness, not live Deepgram, MiniMax, Gemini, or Cartesia network calls
- Local browser flow currently uses the backend session path with mocked provider behavior
- Audio playback is UI-level and interruption-safe, but not yet streaming real PCM frames into an actual output device

## Branch Recommendation

Recommendation: stay on MVP baseline.

Task 14 status: no-go.

Reason:

- The harness closes the budget synthetically, but it does not yet prove live vendor latency
- Stretch work would be premature before live-provider measurements replace the mocked timing path
