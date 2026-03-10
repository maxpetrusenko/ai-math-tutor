# Evaluation Plan

Date: 2026-03-08  
Status: aligned to MVP baseline

## 1. Purpose

Define the benchmark-first evaluation plan for the MVP.

This plan prioritizes:

- latency closure
- committed playback quality
- 2D avatar credibility
- Socratic tutoring quality

## 2. Phase 0 Benchmark Gate

Run the gate before opening stretch branches.

### Required prompts

Run `30` iterations each with:

1. `I don't understand how to solve for x`
2. `Is it 5?`
3. `What about photosynthesis?`

### Required events

- `speech_end`
- `stt_partial_stable`
- `stt_final`
- `llm_first_token`
- `tts_first_audio`
- `first_viseme`
- `audio_done`

### Kill criteria

- p50 `time_to_first_audio` > `500 ms`
- p95 `time_to_first_audio` > `900 ms`
- p95 `speech_end -> stt_final` > `350 ms`
- primary LLM quota or availability blocks demo iteration speed
- avatar sync quality is visibly unstable in repeated runs

## 3. Core Latency Metrics

- `speech_end -> stt_partial_stable`
- `speech_end -> stt_final`
- `stt_final -> llm_first_token`
- `llm_first_token -> tts_first_audio`
- `tts_first_audio -> first_viseme`
- `speech_end -> first_viseme`
- `speech_end -> audio_done`

Report:

- p50
- p95
- min
- max
- failure count

## 4. Chunking and Commit Tests

### Variants

- sentence-boundary commit
- stable-phrase commit
- word-level experiment

### Measure

- first audio latency
- first viseme latency
- naturalness
- interruption behavior
- artifact rate

### Default expectation

- stable-phrase commit likely wins for MVP

## 5. 2D Avatar Evaluation

The visual tutor must be judged directly.

### What to review

- clear `listening` state
- clear `thinking` state
- believable `speaking` state
- mouth motion credibility
- audio/visual sync
- frame stability

### Pass bar

- visibly synchronized
- not distracting
- clearly reads as a tutor rather than a static player

## 6. Pedagogy Evaluation

Use a small fixed evaluation set.

### Subjects

- math: linear equations
- science: photosynthesis basics
- english: subject-verb agreement

### Score dimensions

- Socratic questioning
- scaffolding quality
- direct-answer avoidance
- correctness
- grade fit
- encouragement

### Recommendation

- score each dimension `1-5`
- require no dimension below `3`
- require Socratic questioning average at least `4`
- require correctness average at least `4`

## 7. Fallback Checks

Only if primary path is blocked or misses the gate:

- compare `MiniMax-M2.5` vs `Gemini 3.1 Flash-Lite Preview`
- compare primary TTS vs fallback TTS if fallback branch is opened

These are recovery paths, not MVP baseline requirements.

## 8. Reporting

Every benchmark cycle should output:

- raw event log
- summary latency table
- p50/p95 report
- chunking decision note
- avatar quality note
- pedagogy rubric summary
- branch recommendation: stay MVP or open stretch

## 9. Stretch Branch Evaluation

Only after benchmark gate passes:

- photoreal avatar branch comparison
- WebRTC transport comparison
- richer avatar-rig comparison

Each stretch branch must beat the MVP baseline on a measured dimension, not just look more advanced.

## 10. Final Direction

The MVP is ready when it can prove:

- the latency budget closes
- the 2D visual tutor is credible
- the tutor remains Socratic
- the benchmark report justifies any next branch
