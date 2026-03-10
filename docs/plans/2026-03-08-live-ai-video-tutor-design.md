# Live AI Video Tutor Design Baseline

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Define the agreed MVP design baseline that preserves the full product scope while reducing early execution risk.

**Architecture:** The MVP uses a benchmark-first realtime tutoring loop with browser microphone capture, backend WebSocket orchestration, Deepgram streaming STT, MiniMax-first text generation with Gemini fallback, Cartesia streaming TTS, and a client-side 2D visual tutor. Higher-complexity branches such as photoreal avatars or WebRTC transport stay closed until the benchmark gate proves the latency budget is achievable.

**Tech Stack:** Next.js 15, TypeScript, FastAPI, WebSocket streaming, Deepgram, MiniMax-M2.5, Gemini 3.1 Flash-Lite Preview, Cartesia Sonic-3

---

## Why This Baseline

- Keeps the hard product scope intact: voice in, voice out, visual tutor, Socratic pedagogy, and sub-second response.
- Uses the simplest transport and avatar path that can still satisfy the PRD.
- Forces evidence first through a benchmark gate before opening expensive or risky branches.
- Preserves future swap points for LLM, TTS, and avatar decisions without reopening the whole architecture.

## Locked MVP Decisions

- Realtime transport baseline: backend WebSocket
- Streaming STT: Deepgram
- Primary LLM: MiniMax-M2.5
- Fallback LLM: Gemini 3.1 Flash-Lite Preview
- Streaming TTS: Cartesia Sonic-3
- Visual tutor baseline: client-side 2D animated avatar
- Stretch only after gates pass: photoreal avatar branch and transport upgrade

## Product Constraints That Still Hold

- Grades 6-12
- 1-3 concepts per session
- Socratic method as default teaching behavior
- Under 1 second from student end-of-speech to visible tutor response start
- Under 500 ms to first audio byte
- Lip-sync within plus or minus 80 ms
- Full-path streaming required

## System Shape

```text
Browser mic
  -> backend WebSocket session
  -> Deepgram streaming STT
  -> tutoring prompt + session context
  -> MiniMax or Gemini fallback
  -> committed partial text
  -> Cartesia streaming TTS
  -> browser audio playback
  -> 2D avatar state + mouth animation
  -> latency event recorder
```

## Core Interaction Rules

- One authority owns turn boundaries and interruption handling.
- The tutor only sends committed text to TTS.
- The tutor stays short-turn and spoken-first.
- The visual tutor must show at least idle, listening, thinking, and speaking states.
- Benchmark instrumentation must exist before the team treats the stack as viable.

## Evidence Gates

### Gate A: Latency viability

- Benchmark 30 runs across fixed canned prompts
- Record p50 and p95 stage timings
- Block further branch expansion if time to first audio exceeds budget

### Gate B: Pedagogy viability

- Run a small curated eval set across target grade bands
- Check Socratic questioning, scaffolding, encouragement, and grade fit

### Gate C: Demo readiness

- End-to-end session works locally from documented steps
- Demo shows visible learning progress across 1-3 concepts

## Deferred Branches

- Photoreal avatar vendor bakeoff
- WebRTC transport upgrade
- Richer facial rig or expression system
- Production observability dashboard
- Cost optimization beyond basic reporting

## Risks To Watch

- LLM latency may close the budget only on short turns
- TTS timestamp quality may limit believable lip-sync
- WebSocket transport may be good enough for MVP but not for stretch goals
- A 2D tutor can satisfy the brief only if the speaking and listening cues feel credible
