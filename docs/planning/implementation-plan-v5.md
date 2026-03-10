# Live AI Video Tutor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a sub-second Socratic tutor for grades 6-12 with voice input, streamed voice output, and a real-time visual tutor representation.

**Architecture:** Start with the lowest-risk MVP path: WebSocket audio/control transport, streaming STT, text generation, streaming TTS, and a client-side 2D avatar. Keep the full product scope intact, but gate every higher-risk branch behind Phase 0 latency and integration benchmarks.

**Tech Stack:** Next.js 15, TypeScript, FastAPI, Deepgram streaming STT, MiniMax-M2.5, Gemini 3.1 Flash-Lite Preview, Cartesia Sonic-3

---

## Decisions Locked

- Primary STT: Deepgram streaming WebSocket
- STT fallback: Deepgram Nova-3 with `endpointing=250-300`
- Primary LLM: MiniMax-M2.5
- Fallback LLM: Gemini 3.1 Flash-Lite Preview
- Primary TTS: Cartesia Sonic-3 over WebSocket
- MVP transport: WebSocket
- MVP avatar: client-side 2D animated tutor avatar
- Photoreal avatar work is stretch only after MVP latency passes

## Phase 0 Benchmark Gate

Run 30 iterations each with:

1. "I don't understand how to solve for x"
2. "Is it 5?"
3. "What about photosynthesis?"

Track these events:

- `speech_end`
- `stt_partial_stable`
- `stt_final`
- `llm_first_token`
- `tts_first_audio`
- `first_viseme`
- `audio_done`

Kill criteria:

- p50 `time_to_first_audio` > 500 ms
- p95 `time_to_first_audio` > 900 ms
- p95 `speech_end -> stt_final` > 350 ms
- primary LLM quota or availability blocks demo iteration speed
- avatar sync quality is visibly unstable in repeated runs

Verification checks before implementation:

- confirm MiniMax streaming chunk behavior in the chosen SDK path
- confirm MiniMax project quota is sufficient for benchmark loops and demo iteration
- confirm Cartesia WebSocket requests use `add_timestamps=true`
- confirm Cartesia word timestamps are good enough for the chosen voice
- confirm Deepgram Flux turn stability on short answers
- fall back to Nova-3 with tuned endpointing if Flux is too jumpy

## MVP Architecture

```text
Browser mic
  -> Backend WebSocket
  -> Deepgram streaming STT
  -> MiniMax-M2.5
  -> Cartesia Sonic-3
  -> Browser audio player + 2D avatar
```

Design rules:

- one turn-boundary authority
- streamed text and audio through the full path
- no unstable TTS playback from speculative text
- visible tutor states: idle, listening, thinking, speaking
- LLM requests may start only after a short post-`speech_final` debounce window

## Phase Plan

### Phase 1: Benchmark Harness

**Files:**
- Create: `backend/monitoring/latency_tracker.py`
- Create: `backend/benchmarks/run_latency_benchmark.py`
- Create: `backend/benchmarks/canned_prompts.json`
- Create: `docs/planning/benchmark-results-template.md`

Deliverables:

- event timing schema
- benchmark runner for 30-run batches
- p50 and p95 reporting
- benchmark decision log

### Phase 2: Turn Taking and STT

**Files:**
- Create: `backend/stt/deepgram_client.py`
- Create: `backend/turn_taking/controller.py`
- Create: `backend/turn_taking/state.py`
- Create: `backend/turn_taking/transcript_commit.py`

Deliverables:

- streaming STT session manager
- turn-state machine
- interruption handling
- transcript stabilization rules
- post-`speech_final` debounce before LLM dispatch
- Nova-3 fallback path with tuned endpointing

State machine:

- `idle`
- `listening`
- `thinking`
- `speaking`
- `fading`

Interruption policy:

- fade current tutor audio over 80 ms
- if student speech begins during fade, allow hard cut after 40 ms
- cancel unsent TTS immediately
- discard uncommitted LLM text

Turn-finalization policy:

- use Deepgram as the single turn-boundary authority
- wait 75 ms after `speech_final` before dispatching the LLM
- if new speech arrives inside the debounce window, reopen the turn
- if Flux proves unstable on short student answers, switch to Nova-3 with `endpointing=250-300`

### Phase 3: Tutor Text Generation

**Files:**
- Create: `backend/llm/minimax_client.py`
- Create: `backend/llm/gemini_fallback_client.py`
- Create: `backend/llm/prompt_builder.py`
- Create: `backend/llm/response_policy.py`

Deliverables:

- MiniMax primary client
- Gemini fallback client
- shared prompt contract
- short-turn response policy
- streaming chunk parser for low-latency first-token metrics

Tutor response rules:

- max two spoken sentences per turn
- avoid direct answers
- end most turns with a question
- preserve grade-band language constraints

### Phase 4: TTS and Committed Playback

**Files:**
- Create: `backend/tts/cartesia_client.py`
- Create: `backend/tts/commit_manager.py`
- Create: `backend/tts/audio_buffer.py`

Deliverables:

- Cartesia streaming client with `add_timestamps=true`
- committed phrase manager
- audio buffering and interruption hooks
- word-timestamp extraction for avatar timing

Commit rules:

- sentence boundary preferred
- stable phrase allowed
- no TTS from unstable trailing fragments
- depend on word timestamps for MVP
- phoneme timestamps are optional optimization only
- use the exact Cartesia WebSocket parameter name `add_timestamps`

### Phase 5: Frontend Tutor UI

**Files:**
- Create: `frontend/app/page.tsx`
- Create: `frontend/components/TutorSession.tsx`
- Create: `frontend/components/MicCapture.tsx`
- Create: `frontend/components/AudioPlayer.tsx`
- Create: `frontend/components/AvatarRenderer.tsx`
- Create: `frontend/components/LatencyMonitor.tsx`

Deliverables:

- live session shell
- microphone capture
- streamed audio playback
- 2D avatar state machine
- on-screen latency panel

Avatar MVP:

- 2D canvas or SVG
- 6 to 8 mouth shapes
- drive mouth motion from word timestamps plus audio energy envelope
- speaking, listening, and thinking visuals

### Phase 6: Pedagogy Evaluation

**Files:**
- Create: `eval/test_turns.json`
- Create: `eval/socratic_checks.py`
- Create: `eval/rubric.md`

Deliverables:

- manually curated 20 to 30 turn eval set
- rubric for direct-answer avoidance, scaffolding, encouragement, and grade fit
- pass/fail summary for each concept track

Evaluation subjects:

- math: linear equations
- science: photosynthesis basics
- english: subject-verb agreement

### Phase 7: Stretch Branches

Only open after MVP passes latency and pedagogy gates.

Possible branches:

- photoreal managed avatar
- OSS photoreal avatar
- WebRTC transport upgrade
- richer avatar rig

## Success Criteria

- p50 `time_to_first_audio` < 500 ms
- p95 `time_to_first_audio` < 900 ms
- under 1 second to visible tutor response start
- lip-sync within +/- 80 ms
- 20+ eval turns pass rubric
- demo covers 1 to 3 concepts
- local setup works from documented steps

## Open Checks

- confirm MiniMax production quota and stability for demo cadence
- confirm Gemini 3.1 Flash-Lite Preview fallback quota in the target project
- confirm Cartesia word timestamps quality on the chosen voice
- confirm browser avatar feels credible enough before opening photoreal branch
- confirm whether the chosen MiniMax client library exposes streaming chunks directly or needs an adapter
