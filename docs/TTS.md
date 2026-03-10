# TTS Decision

Date: 2026-03-08  
Status: aligned to MVP baseline

## 1. Recommendation

Use `Cartesia Sonic-3` over WebSocket as the MVP TTS provider.

Use `MiniMax speech` only as a fallback branch if:

- Cartesia availability becomes a blocker
- word timestamps are not stable enough for the avatar
- benchmark results fail the latency gate

## 2. Why Cartesia Wins for MVP

The MVP now uses a client-side 2D avatar.

That makes these TTS traits decisive:

- low time to first audio
- streamed incremental input
- reliable word timestamps
- controllable flush behavior
- good fit for committed phrase playback

`Cartesia` fits that shape best from current official docs.

### Decisive reasons

- Cartesia recommends WebSocket for real-time apps
- pre-opened WebSockets can save roughly `200 ms`
- it supports incremental context continuation
- it supports flush control
- it supports timestamps
- Sonic-3 publishes very low first-audio latency claims

## 3. Playback Rules

MVP should use committed playback, not speculative playback.

### Rules

- sentence boundary preferred
- stable phrase allowed
- no TTS from unstable trailing fragments
- final flush at turn completion
- interruption cancels unsent or unplayed audio immediately

## 4. Chunking Guidance

Default to phrase-first chunking.

### Start with

- 3-7 word chunks
- punctuation-aware grouping
- minimum character threshold to avoid one-word spam

### Measure

- `tts_first_audio`
- `first_viseme`
- lip-sync stability
- artifact rate
- perceived naturalness

### Working assumption

- phrase-first chunking is the likely MVP default
- word-level chunking remains an experiment, not the baseline

## 5. Avatar Fit

The 2D avatar should use:

- word timestamps when available
- audio energy envelope as fallback smoothing input

That is a better fit for MVP than solving phoneme-perfect animation first.

## 6. Fallback Policy

Only open a fallback TTS branch if one of these occurs:

- Cartesia latency misses the benchmark gate
- Cartesia timestamps are not usable for the chosen 2D rig
- provider quota or reliability blocks demo iteration

If fallback is needed:

- use `MiniMax speech`
- keep the same `TTSProvider` interface
- rerun the benchmark gate before changing defaults

## 7. Required Tests

- compare sentence-boundary commit vs stable-phrase commit
- compare phrase chunking vs word chunking
- measure `tts_first_audio`
- measure `first_viseme`
- verify interruption cuts queued audio correctly
- verify timestamps are good enough to drive the 2D avatar

## 8. Cost Notes

Do not optimize for cost before benchmark closure.

MVP decision order:

1. latency
2. timestamp quality
3. interruption behavior
4. cost

## 9. Final Call

For MVP:

- primary TTS: `Cartesia Sonic-3`
- committed phrase playback
- timestamp-driven 2D avatar
- fallback branch only if benchmark gate fails

## 10. Sources

- Cartesia WebSocket TTS: https://docs.cartesia.ai/api-reference/tts/websocket
- Cartesia endpoint comparison: https://docs.cartesia.ai/api-reference/tts/compare-tts-endpoints
- Cartesia contexts: https://docs.cartesia.ai/api-reference/tts/working-with-web-sockets/contexts
- Cartesia flush IDs: https://docs.cartesia.ai/api-reference/tts/working-with-web-sockets/context-flushing-and-flush-i-ds
- MiniMax TTS WebSocket guide: https://platform.minimax.io/docs/guides/speech-t2a-websocket
