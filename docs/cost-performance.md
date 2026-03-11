# Cost / Performance Note

Documents provider choices, cost tradeoffs, and performance baseline for the Nerdy MVP.

Companion policy doc: `docs/avatar-costs-and-licensing.md`

## Provider Stack

| Layer | Provider | Rationale | Cost (USD) |
|-------|----------|-----------|-------------|
| STT | Deepgram | Low latency streaming, per-second pricing | $0.009/minute |
| LLM | MiniMax | Fast response, token-efficient, Chinese-trained (good for English too) | ~$0.40/M tokens |
| LLM Fallback | Gemini | Reliability, broad coverage | ~$2.00/M tokens |
| TTS | Cartesia | Low latency, expressive voices | ~$0.03/1K chars |
| Avatar | CSS (2D) | Zero bundle cost, reliable | $0 |
| Avatar | Three.js (3D) | Lazy-loaded, client-side rendering | $0 |

## Performance Baseline

### Target Latencies

| Stage | Target | Actual (synthetic) | Actual (live provider est.) |
|-------|--------|-------------------|---------------------------|
| STT First Token | 200ms | ~50ms | ~150ms |
| LLM First Token | 400ms | ~100ms | ~300ms |
| TTS First Audio | 500ms | ~80ms | ~400ms |
| End-to-End | 1000ms | ~650ms | ~900ms |

### Latency Budget Breakdown

```
STT (Deepgram):     ~150ms p50,  ~250ms p95
LLM (MiniMax):      ~300ms p50,  ~500ms p95
TTS (Cartesia):     ~400ms p50,  ~600ms p95
Network + Processing: ~50ms
─────────────────────────────────────
Total E2E:          ~900ms p50, ~1350ms p95
```

## Cost Per Session

### Typical 5-Minute Tutoring Session

| Component | Usage | Cost |
|-----------|-------|------|
| STT (Deepgram) | 5 min streaming | $0.045 |
| LLM (MiniMax) | ~3K tokens (student + tutor) | $0.0012 |
| TTS (Cartesia) | ~2K characters output | $0.06 |
| Avatar (Three.js) | Client-side | $0 |
| **Total per session** | | **~$0.11** |

### Scale Projection

| Sessions/day | Daily Cost | Monthly Cost (30 days) |
|--------------|------------|------------------------|
| 100 | $11 | $330 |
| 1,000 | $110 | $3,300 |
| 10,000 | $1,100 | $33,000 |

## Provider Tradeoffs

### Why Deepgram for STT?

- Streaming WebSocket API (no polling)
- Low per-second cost (no minimum charges)
- Fast word-level timestamps
- Good accuracy across accents

### Why MiniMax over GPT-4?

- 2-3x faster first-token latency
- 5-10x lower cost per token
- Sufficient quality for tutoring domain
- Fallback to Gemini when needed

### Why Cartesia for TTS?

- Expressive voices (less robotic than alternatives)
- Fast streaming (no phrase buffering delay)
- Word-level timing metadata for lip-sync
- Per-character pricing (no minimum)

### Why CSS Avatar First?

- Zero bundle cost impact
- Reliable state transitions
- Fast development iteration
- Three.js lazy-loaded as opt-in enhancement

## Optimization Choices

### What We Optimized For

1. **Latency over cost**: Streaming everywhere, no batching delays
2. **Per-session cost over scale**: Pay-per-use, no reserved capacity
3. **UX over provider lock-in**: Registry pattern allows hot-swapping
4. **Observability over complexity**: Latency tracking at every stage

### What We Deferred

- Audio quality optimization (16kHz is sufficient for demo)
- Avatar photorealism (CSS/Three.js abstraction)
- Multi-user capacity (single-session WebSocket)
- Persistent conversation storage

## Limitations

- **No CDN caching**: Live WebSocket path bypasses CDN
- **No audio compression**: Raw base64 chunks (adds ~33% overhead)
- **No request batching**: Each turn is independent
- **No session persistence**: Refresh loses conversation

## Next Steps for Production

If scaling beyond demo:

1. Add Redis for session state (shared WebSocket servers)
2. Cache LLM responses for common questions
3. Batch TTS requests where timing allows
4. Consider edge-located STT/TTS for latency
5. Implement rate limiting per user

## Premium Avatar Vendor Policy

**Simli, HeyGen, and similar premium avatar providers are RESTRICTED for MVP:**

- Use only in explicit bakeoff lanes with cost approval
- Do NOT integrate into main session path
- Do NOT bundle premium avatar binaries in repo
- All demo assets must be repo-original (CSS/Three.js primitives)

Rationale: Premium providers have unpredictable per-minute costs and licensing restrictions. MVP ships with zero-cost local avatars only.

## Asset Licensing Guardrails

- Daily avatar iteration stays on repo-original CSS and Three.js presets.
- Future imported assets must come from an approved list with pinned source + license notes.
- “Inspired” presets stay non-branded and demo-safe.
- Demo success must not depend on marketplace or premium-provider rights.

See `docs/avatar-costs-and-licensing.md` for the frozen source list and spend policy.

## References

- [Deepgram pricing](https://developers.deepgram.com/pricing)
- [MiniMax pricing](https://api.minimax.chat/document/price)
- [Cartesia pricing](https://cartesia.ai/pricing)
