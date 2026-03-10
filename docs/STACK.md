# Stack Recommendation

Date: 2026-03-08  
Status: aligned to MVP baseline

## 1. Goal

Define the locked MVP stack and the deferred branches for the Live AI Video Tutor.

This version aligns to:

- `requirements.md`
- `PRD.md`
- `docs/planning/implementation-plan-v5.md`

## 2. Locked MVP Decisions

- Client: `Next.js 15` + `TypeScript`
- Backend: `FastAPI`
- Transport: backend `WebSocket`
- STT: `Deepgram` streaming WebSocket
- Primary LLM: `MiniMax-M2.5`
- Fallback LLM: `Gemini 3.1 Flash-Lite Preview`
- Primary TTS: `Cartesia Sonic-3` over WebSocket
- Alternate TTS: `MiniMax` through the same TTS factory path
- MVP visual tutor: client-side `2D CSS` avatar by default, optional lazy-loaded `3D Three.js`
- Benchmark gate required before higher-risk branches

## 3. Why This Baseline

This stack is chosen for MVP because it optimizes for:

- lowest-risk latency closure
- measurable stage boundaries
- simpler transport
- simple default visual layer with an opt-in richer branch
- fast iteration during the planning-to-build transition

It does not reduce product scope. It reduces MVP implementation risk.

## 4. Core Path

```text
Browser mic
  -> Backend WebSocket
  -> STT provider session
  -> MiniMax-M2.5
  -> Cartesia Sonic-3 / MiniMax TTS
  -> Browser audio player + avatar provider
```

## 5. Benchmark Gate

Before opening photoreal avatar or transport-upgrade branches, run the benchmark gate.

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

## 6. Layer Table

| Layer | MVP choice | Notes |
| --- | --- | --- |
| Client | `Next.js 15` + `TypeScript` | keep shell simple |
| Backend API | `FastAPI` | websocket session authority |
| Transport | backend WebSocket | MVP baseline |
| STT | `Deepgram` | default via provider factory |
| LLM | `MiniMax-M2.5` | default runtime path |
| LLM fallback | `Gemini 3.1 Flash-Lite Preview` | behind provider switch |
| TTS | `Cartesia Sonic-3` | default via provider factory |
| TTS alt | `MiniMax` | same context / phrase / flush contract |
| Visual tutor | client-side `2D CSS` avatar | default |
| Visual tutor alt | lazy-loaded `Three.js` avatar | opt-in from UI |
| Metrics | structured latency events + benchmark report | required |

## 7. Design Rules

- one turn-boundary authority
- no unstable TTS playback from speculative text
- stream through the full path
- visible tutor states: `idle`, `listening`, `thinking`, `speaking`
- browser mic sends `audio.chunk.bytes_b64` when audio is available
- typecheck must work without a prior build
- benchmark first, upgrade later

## 8. Deferred Branches

These are explicitly not part of the default MVP baseline.

- photoreal managed avatar
- OSS photoreal avatar
- WebRTC transport upgrade
- richer avatar rig

Only open these branches after the benchmark gate passes.

## 9. Current Runtime Notes

- STT, TTS, and LLM selection now flow through provider-backed registry paths
- the session server resolves LLM providers through `ProviderSwitch`, which creates providers via the shared registry-backed path
- frontend `typecheck` runs `next typegen && tsc -p tsconfig.typecheck.json --noEmit`
- frontend `verify` runs `pnpm test && pnpm build && pnpm typecheck`

## 10. Final Direction

Build the simplest stack that can still prove:

- sub-second tutor response start
- believable visual tutor presence
- measurable stage timings
- Socratic tutoring quality

The first prototype should win on proof, not ambition.
