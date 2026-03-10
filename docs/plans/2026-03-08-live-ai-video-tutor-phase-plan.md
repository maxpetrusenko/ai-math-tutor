# Live AI Video Tutor Phase Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Break the updated MVP baseline into clear execution phases where each phase contains multiple concrete tasks or features and ends with an evidence-based gate.

**Architecture:** Build the tutor through a benchmark-gated pipeline: benchmark first, then realtime turn taking, then tutoring generation, then TTS and avatar playback, then evaluation and demo packaging. Keep the MVP on the simpler WebSocket plus 2D avatar path until hard latency and pedagogy evidence justify more ambitious branches.

**Tech Stack:** Next.js 15, TypeScript, FastAPI, Deepgram streaming STT, MiniMax-M2.5, Gemini 3.1 Flash-Lite Preview, Cartesia Sonic-3, WebSocket transport, client-side 2D avatar

---

## Phase 0: Benchmark Gate

**Objective:** Prove the chosen stack can plausibly meet the latency budget before full feature buildout.

**Features and tasks:**

- Define the canonical latency event schema
- Create canned prompts and replay inputs for repeatable runs
- Build a 30-run benchmark harness
- Capture p50 and p95 timings for each stage
- Create a benchmark report template with pass/fail criteria
- Record decision outcomes and blocked branches

**Evidence required:**

- `time_to_first_audio` p50 under 500 ms
- `time_to_first_audio` p95 under 900 ms
- `speech_end -> stt_final` p95 under 350 ms
- Stable repeated runs with no obvious sync collapse

**If phase fails:**

- tighten prompt length
- reduce generation length
- inspect STT and LLM bottlenecks
- delay photoreal and transport upgrade branches

## Phase 1: Session Spine and Turn Taking

**Objective:** Establish the realtime session loop and interruption-safe control plane.

**Features and tasks:**

- Build backend WebSocket session lifecycle
- Implement mic audio ingress and server session startup
- Add Deepgram streaming STT client and transcript updates
- Create turn-taking state machine with `idle`, `listening`, `thinking`, `speaking`, and `fading`
- Implement transcript stabilization and commit rules
- Add interruption handling, fadeout, and cancel semantics
- Emit session and turn-boundary latency events

**Exit gate:**

- Student speech reaches transcript commit reliably
- Tutor turn starts and ends cleanly
- User interruption does not leave stale audio or stale state

## Phase 2: Tutor Intelligence and Socratic Policy

**Objective:** Produce fast, short, grade-appropriate tutoring turns that match the PRD.

**Features and tasks:**

- Build shared prompt contract for subject, grade band, and history
- Implement MiniMax primary client
- Implement Gemini fallback client behind the same interface
- Define short-turn response policy for spoken output
- Add Socratic guardrails: ask questions, scaffold, redirect gently
- Add grade-band language controls for grades 6-8, 9-10, and 11-12
- Bound output length so latency stays inside budget

**Exit gate:**

- Most turns end with a forward-moving question
- Responses stay short enough for realtime speech
- Fallback model can replace the primary without session breakage

## Phase 3: TTS and Committed Audio Path

**Objective:** Convert committed tutor text into low-latency spoken output without unstable playback artifacts.

**Features and tasks:**

- Implement Cartesia Sonic-3 streaming client
- Add committed phrase manager between LLM output and TTS
- Buffer streamed audio for playback continuity
- Carry word timestamps through the pipeline
- Wire interruption hooks to stop unsent or stale audio immediately
- Record TTS first-byte and playback-start timings
- Tune commit policy between sentence and phrase boundaries

**Exit gate:**

- Audio starts quickly and consistently
- No speculative or visibly wrong speech leaks to playback
- Timestamp quality is good enough for MVP lip-sync

## Phase 4: Visual Tutor MVP

**Objective:** Deliver a credible realtime visual tutor with visible state changes and acceptable lip-sync.

**Features and tasks:**

- Build the session shell UI
- Add microphone controls and connection states
- Add streamed audio playback controls
- Implement 2D avatar renderer in canvas or SVG
- Create mouth-shape mapping from timestamps and energy envelope
- Add visible `listening`, `thinking`, and `speaking` states
- Surface a live latency monitor for local debugging

**Exit gate:**

- Tutor presence reads as visual tutoring, not audio-only chat
- Avatar starts visibly with the audio turn
- Lip-sync stays within plus or minus 80 ms in repeated runs

## Phase 5: Evaluation and Quality Gates

**Objective:** Prove the tutor satisfies both latency and educational quality requirements.

**Features and tasks:**

- Build a curated eval set across math, science, and English
- Define a rubric for Socratic behavior, scaffolding, encouragement, and grade fit
- Score representative tutoring turns
- Compare benchmark outputs against acceptance criteria
- Log limitations, failure modes, and deferred improvements
- Produce a benchmark report and quality summary

**Exit gate:**

- 20 or more eval turns pass the rubric
- Latency metrics satisfy the PRD minimum bar
- Known limitations are documented clearly enough for reviewers

## Phase 6: Demo Packaging and Submission Readiness

**Objective:** Convert the working MVP into a clean demo and submission package.

**Features and tasks:**

- Select 1-3 concepts for the demo arc
- Write demo script and operator runbook
- Rehearse one-command or near-one-command local startup
- Capture the 1-5 minute demo video
- Finalize README, setup notes, and decision log
- Package benchmark evidence, eval summary, and explicit limitations

**Exit gate:**

- Demo shows clear conceptual progress
- Setup docs are reproducible
- Submission package maps directly to rubric categories

## Phase 7: Stretch Branches

**Objective:** Open only after the MVP proves viable.

**Features and tasks:**

- Evaluate photoreal avatar providers against the 2D baseline
- Test WebRTC transport upgrade against WebSocket baseline
- Explore richer avatar rig and expression system
- Compare cost, quality, and latency of alternate branches
- Decide whether any branch replaces the MVP baseline

**Exit gate:**

- Stretch branch beats MVP baseline on clearly measured criteria
- Added complexity is justified by demo or rubric value

## File Ownership Map

### Backend

- `backend/monitoring/`
- `backend/benchmarks/`
- `backend/stt/`
- `backend/turn_taking/`
- `backend/llm/`
- `backend/tts/`

### Frontend

- `frontend/app/`
- `frontend/components/`

### Evaluation and docs

- `eval/`
- `docs/planning/`
- `README.md`

## Phase Order Rule

- Do not open Phase 4 before Phase 0 and Phase 1 evidence exists.
- Do not open Phase 7 before Phases 0 through 6 satisfy their gates.
- If any gate fails, fix the bottleneck before adding scope.
