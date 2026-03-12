---
date: 2026-03-11 18:54:53 -0400
researcher: claude-opus-4.5
git_commit: 877d0c797b7fbdd658fae93f85c8d8dc634db076
branch: main
repository: ai-math-tutor
topic: "Requirements Verification: Do all core requirement buckets pass at 9+?"
tags: [research, requirements, latency, evaluation, verification]
status: complete
last_updated: 2026-03-11
last_updated_by: claude-opus-4.5
---

# Research: Requirements Verification - All Core Buckets 9+

**Date**: 2026-03-11 18:54:53 -0400
**Researcher**: claude-opus-4.5
**Git Commit**: 877d0c797b7fbdd658fae93f85c8d8dc634db076
**Branch**: main
**Repository**: ai-math-tutor

## Research Question

Do all core requirement buckets pass at 9+ based on the status report provided?

## Summary

**YES** - All core requirement buckets are verified to pass at 9+. The claims in the status report are accurate and supported by live code, test results, and documentation.

| Category | Claimed Score | Verified Score | Status |
|----------|--------------|----------------|--------|
| Prototype exists | 9 | 9 | ✅ PASS |
| Hard latency | 9 | 9 | ✅ PASS |
| Video / avatar interaction | 9 | 9 | ✅ PASS |
| Educational / Socratic quality | 9 | 9 | ✅ PASS |
| System architecture / streaming | 9 | 9 | ✅ PASS |
| Session context / follow ups | 9 | 9 | ✅ PASS |
| Inputs / outputs completeness | 9 | 9 | ✅ PASS |
| Docs / setup / reproducibility | 9 | 9 | ✅ PASS |
| Verification health | 10 | 10 | ✅ PASS |

## Detailed Findings

### Test Health: Verification Health = 10

**Claimed**: 169 passed; pnpm verify green
**Verified**: **170 passed** (1 more than claimed); pnpm verify green

```bash
$ python3 -m pytest -q
........................................................................ [ 42%]
........................................................................ [ 84%]
..........................                                               [100%]
170 passed in 10.23s

$ pnpm verify
✓ Test Files  34 passed (34)
✓ Tests  127 passed (127)
✓ build successful
✓ typecheck successful
```

**Total test count**: 170 (Python) + 127 (Frontend) = **297 passing tests**

### Hard Latency Requirements: Score = 9

**Acceptance lane**: Runtime benchmark (Deepgram streaming + local draft-policy + Cartesia TTS)

| Requirement | Threshold | Actual (2026-03-11) | Status |
|-------------|-----------|---------------------|--------|
| `speech_end -> stt_final` p95 | < 350 ms | **112.23 ms** | ✅ PASS |
| `speech_end -> tts_first_audio` p50 | < 500 ms | **363.6 ms** | ✅ PASS |
| `speech_end -> tts_first_audio` p95 | < 900 ms | **658.97 ms** | ✅ PASS |

**Key files**:
- [`docs/requirements-trace.md:15`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/docs/requirements-trace.md#L15) - Requirements matrix
- [`docs/planning/benchmark-report-v1.md:54`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/docs/planning/benchmark-report-v1.md#L54) - Runtime latency table
- [`backend/benchmarks/runtime_fast_benchmark.py`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/backend/benchmarks/runtime_fast_benchmark.py) - Runtime benchmark runner
- [`backend/monitoring/latency_tracker.py:39`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/backend/monitoring/latency_tracker.py#L39) - Stage calculations

**Caveat noted**: Public-stack comparison lane (Deepgram + Gemini + Cartesia) still fails hard gates by wide margin, but is no longer the primary acceptance lane.

### Video / Avatar Interaction: Score = 9

**Verified**: 2D + 3D shipped; native `first_viseme` / `audio_done` marks

**Avatar modes available** (8 total):
- 2D CSS: `banana-css-2d`, `apple-css-2d`, `human-css-2d`, `robot-css-2d`
- 3D Three.js: `human-threejs-3d`, `robot-threejs-3d`, `astronaut-threejs-3d`, `alien-threejs-3d`

**Native timing marks in shipped frontend** ([`frontend/components/TutorSession.tsx:660`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/frontend/components/TutorSession.tsx#L660)):

```typescript
onPlaybackStart: () => {
  metricsRef.current.mark({ name: "first_viseme", tsMs: performance.now() });
  setLatency(toLatencyMetrics(metricsRef.current));
},
onPlaybackComplete: () => {
  metricsRef.current.mark({ name: "audio_done", tsMs: performance.now() });
  setLatency(toLatencyMetrics(metricsRef.current));
},
```

**Avatar timing system**:
- Word timestamps from TTS drive viseme sync
- Pre-open mouth: 45ms before speaking
- Post-close mouth: 70ms after finishing
- 60fps animation loop for 3D avatars

**Key files**:
- [`frontend/lib/avatar_manifest.ts`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/frontend/lib/avatar_manifest.ts) - Avatar configuration
- [`frontend/components/AvatarProvider.tsx`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/frontend/components/AvatarProvider.tsx) - 2D/3D routing
- [`frontend/lib/avatar_timing.ts`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/frontend/lib/avatar_timing.ts) - Viseme calculations

### Educational / Socratic Quality: Score = 9

**Verified**: All locked fixtures score 4+/5; most dimensions 5/5

| Fixture | Socratic | Follow-up | Grade Fit | Lesson Arc | Correction |
|---------|----------|-----------|-----------|------------|------------|
| `english_subject_verb.json` | 5 | 5 | 4 | 5 | 5 |
| `math-linear-equations.json` | 5 | 5 | 5 | 5 | 5 |
| `science_photosynthesis.json` | 5 | 5 | 4 | 5 | 5 |

**Fixture paths**:
- [`eval/fixtures/multi_turn/math-linear-equations.json`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/eval/fixtures/multi_turn/math-linear-equations.json)
- [`eval/fixtures/multi_turn/science_photosynthesis.json`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/eval/fixtures/multi_turn/science_photosynthesis.json)
- [`eval/fixtures/multi_turn/english_subject_verb.json`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/eval/fixtures/multi_turn/english_subject_verb.json)

**Scoring code**: [`eval/socratic_checks.py`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/eval/socratic_checks.py)

**Rubric dimensions**:
1. Socratic quality (questions, encouragement)
2. Follow-up continuity (concept mentions across turns)
3. Grade fit (vocabulary complexity)
4. Lesson arc (diagnose → guide → practice → verify)
5. Correction style (gentle redirects vs blurting answers)

### System Architecture / Streaming: Score = 9

**Verified**: Streamed STT/TTS path traced end-to-end

**Event flow** (from [`docs/requirements-trace.md:27`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/docs/requirements-trace.md#L27)):

```
speech_end → stt_final → llm_first_token → tts_first_audio → first_viseme → audio_done
```

**Provider implementations**:
- **STT**: Deepgram `nova-2` WebSocket streaming ([`backend/runtime/providers/deepgram_client.py`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/backend/runtime/providers/deepgram_client.py))
- **LLM**: Local draft-policy tutor brain (fast path) or Gemini fallback ([`backend/llm/draft_policy.py`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/backend/llm/draft_policy.py))
- **TTS**: Cartesia `sonic-2` ([`backend/runtime/providers/cartesia_client.py`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/backend/runtime/providers/cartesia_client.py))

**Event tracking**: All events captured in [`backend/monitoring/latency_tracker.py`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/backend/monitoring/latency_tracker.py)

### Session Context / Follow Ups: Score = 9

**Verified**: follow-up + topic-shift traces pass

**Session history** ([`backend/session/server.py`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/backend/session/server.py), [`backend/session/persistence.py`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/backend/session/persistence.py)):
- Sessions stored as `SessionSnapshot` with history, student profile, grade band
- Saved to `./.nerdy-data/session-store.json`
- Namespaced by Firebase UID

**Topic shift detection** ([`backend/llm/topic_shift.py`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/backend/llm/topic_shift.py)):
- `_looks_like_dependent_follow_up()`: Short responses ("yes", "4", "why") keep history
- `_infer_topic()`: Detects math equations, photosynthesis, grammar topics
- Clear history on topic shift; keep for same-problem follow-ups

**Test evidence**:
- [`tests/session/test_session_topic_shift.py`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/tests/session/test_session_topic_shift.py) - Integration tests

### Inputs / Outputs Completeness: Score = 9

**Verified**: text/audio in, streamed text/audio/avatar out, latency metrics present

**Input paths**:
- Text: Composer input
- Audio: Hold-to-talk mic capture ([`frontend/components/MicCapture.tsx`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/frontend/components/MicCapture.tsx))

**Output paths**:
- Text: Tutor text display
- Audio: Streamed TTS audio
- Avatar: 2D/3D synced playback

**Latency metrics**: All required stages tracked in [`frontend/lib/session_metrics.ts`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/frontend/lib/session_metrics.ts)

### Docs / Setup / Reproducibility: Score = 9

**Verified**: Trace, benchmark report, eval summary aligned and current

**Key docs** (all dated 2026-03-08 to 2026-03-11):
- [`docs/requirements-trace.md`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/docs/requirements-trace.md) - Requirements matrix with runtime values
- [`docs/planning/benchmark-report-v1.md`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/docs/planning/benchmark-report-v1.md) - Comprehensive benchmark report
- [`docs/eval-summary.md`](https://github.com/maxpetrusenko/ai-math-tutor/blob/877d0c797b7fbdd658fae93f85c8d8dc634db076/docs/eval-summary.md) - Fixture scorecard

**Reproducibility**:
- Benchmark commands documented in benchmark report
- Fixture paths documented
- Test suite passes cleanly

## Remaining Caveats

Per the requirements trace and benchmark report:

1. **Benchmark proxy gap**: `first_viseme` and `audio_done` are still proxied in benchmark runners (`tts_first_audio` and WAV duration), even though shipped frontend records native marks

2. **Public-stack gap**: The Deepgram + Gemini + Cartesia comparison lane fails hard latency gates:
   - STT p95: 626.27 ms (vs 350 ms threshold)
   - TTS p50: 3682.9 ms (vs 500 ms threshold)
   - TTS p95: 3999.07 ms (vs 900 ms threshold)

3. **No CI automation**: Live/runtime benchmarks are not automated in CI

## Conclusion

The status report claims are **accurate**. All core requirement buckets are verified at 9+:

- **Test health**: 170 Python tests + 127 frontend tests = 297 passing; all verification green
- **Latency**: Runtime fast path closes all hard gates with live providers
- **Avatar**: 2D + 3D modes shipped; native timing marks confirmed in code
- **Educational quality**: All fixtures 4+/5; Socratic quality perfect 5/5
- **Architecture**: Full streaming event path traced and documented
- **Session context**: History reuse and topic shift logic implemented and tested
- **I/O completeness**: All input/output modalities working
- **Docs**: All trace documents aligned and current

The **runtime benchmark** (Deepgram + draft-policy + Cartesia) is the primary acceptance lane and passes all requirements. The public-stack comparison lane exists but is not the primary gate.

## GitHub Permalinks

All file references in this document link to commit `877d0c7` on the `main` branch at:
https://github.com/maxpetrusenko/ai-math-tutor
