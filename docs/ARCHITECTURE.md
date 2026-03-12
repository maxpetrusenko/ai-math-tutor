# Architecture

Date: 2026-03-08  
Status: aligned to MVP baseline

## 1. Purpose

Define the MVP architecture for the benchmark-first prototype.

This version assumes:

- backend WebSocket transport
- client-side 2D avatar by default, with optional 3D Three.js rendering
- Deepgram streaming STT via provider-backed session factory
- MiniMax primary LLM
- Gemini fallback LLM
- Cartesia primary TTS, with MiniMax TTS available behind the provider layer

## 2. Core Path

```text
Browser mic
  -> Backend WebSocket
  -> STT provider session
  -> turn controller
  -> MiniMax-M2.5 + Gemini fallback
  -> commit manager
  -> TTS provider context
  -> browser audio player + avatar provider
```

## 3. Core Principles

- benchmark before branch expansion
- one turn-boundary authority
- no speculative audio playback
- measurable stage timings
- keep optional providers behind narrow contracts
- default to the lightest tutor path that still satisfies product scope

## 4. Runtime Split

### Frontend

Responsibilities:

- capture mic input
- stream audio to backend WebSocket
- send `audio.chunk.bytes_b64` payloads when browser audio is available
- display transcript and latency panel
- play streamed tutor audio
- render avatar states through a provider shell
- default to 2D CSS tutor visuals, with repo-original 2D SVG tutors available behind the same lightweight provider lane
- lazy-load Three.js only when the `3D Three.js` provider is selected
- render mouth motion from timestamps and audio energy

### Backend

Responsibilities:

- own session state
- own turn taking
- create one STT session per websocket turn authority
- stream STT through the provider-backed session contract
- stream LLM through MiniMax primary + Gemini fallback policy
- manage committed playback
- create TTS contexts through provider factories
- merge default and per-turn `voice_config`
- emit benchmark events

### Benchmark Layer

Responsibilities:

- replay fixed prompts
- record latency metrics
- compute p50 and p95
- produce benchmark report

## 5. State Machine

Session states:

- `idle`
- `listening`
- `thinking`
- `speaking`
- `fading`
- `failed`

Avatar states:

- `idle`
- `listening`
- `thinking`
- `speaking`
- `fading`

## 6. Turn Lifecycle

1. browser mic records chunks and sends `audio.chunk.bytes_b64` over WebSocket
2. backend forwards bytes into the active STT provider session
3. Deepgram session emits partial-stable and final transcript events
4. turn controller commits final user text
5. MiniMax streams tutor text with Gemini fallback available
6. commit manager promotes only safe text to playback
7. selected TTS provider starts context and streams audio for committed text
8. browser audio player starts playback
9. avatar provider renders 2D by default, with either CSS or SVG variants, or 3D on selection

## 7. Required Interfaces

### `STTProvider`

- `open_session(tracker)`

### `StreamingSTTSession`

- `push_audio(chunk, ts_ms=None)`
- `finalize(ts_ms)`
- `close()`

### `LLMProvider`

- `stream_response(messages, settings)`

Current runtime note:

- the session server now resolves LLM providers through `ProviderSwitch`
- `ProviderSwitch` creates providers via the shared registry-backed path
- `backend/providers/llm/*` contains the registered MiniMax and Gemini wrappers

### `CommitManager`

- `push_token(token)`
- `emit_committed_phrase()`
- `finish_turn()`
- `reset()`

### `TTSProvider`

- `start_context(turn_id, voice_config)`
- `send_phrase(text, tracker, first_audio_ts_ms, is_final=false)`
- `flush()`
- `cancel()`

### `LatencyRecorder`

- `mark(event_name, ts_ms, metadata)`
- `flush(session_id)`

## 8. Event Schema

Track at minimum:

- `speech_end`
- `stt_partial_stable`
- `stt_final`
- `llm_first_token`
- `tts_first_audio`
- `first_viseme`
- `audio_done`

Optional but useful:

- `interrupt_start`
- `interrupt_cut_complete`
- `turn_complete`

## 9. Repo Shape

```text
frontend/
  app/
  components/
  lib/
backend/
  benchmarks/
  llm/
  monitoring/
  providers/
  stt/
  tts/
  turn_taking/
eval/
docs/
```

## 10. Playback Policy

Committed playback only.

### Meaning

- do not send unstable trailing fragments to TTS
- prefer sentence boundary
- allow stable phrase when latency requires it
- cancel queued audio fast on interruption

## 11. Avatar Policy

Default avatar path should be:

- client-side
- simple to iterate
- visually clear in `listening`, `thinking`, and `speaking`
- driven by word timestamps plus energy smoothing
- use the `2D CSS` provider by default; `2D SVG` stays in the same client-side low-latency path for richer tutor identities

Optional avatar path:

- `3D Three.js`
- lazy-loaded only when selected
- should not increase the default 2D bundle path

Do not overbuild the 3D rig before benchmark closure.

## 12. Deferred Branches

Only after benchmark pass:

- photoreal avatar provider spike
- WebRTC transport spike
- richer viseme rig

## 13. Final Direction

Treat MVP as a proof machine:

- close latency budget
- prove tutoring loop quality
- prove the visual tutor works

Then decide whether higher-complexity branches are worth opening.
