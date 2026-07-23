# Talking Avatar Replacement: Phase 0

Date: 2026-07-17  
Status: Implemented and verified  
Related incident: [GitHub issue #30](https://github.com/maxpetrusenko/ai-math-tutor/issues/30)

## Decision

Replace the twelve procedural local avatars (four SVG, four CSS, and four
Three.js heads) with one self-hosted `@met4citizen/talkinghead` adapter. Keep
managed Simli and HeyGen entries behind the existing LiveKit boundary.

TalkingHead is the best fit because it provides a browser-native Three.js
runtime, an MIT license, active releases, GLB/Mixamo rigs, ARKit/Oculus
visemes, streamed PCM audio, word timing, interruption, and audio-driven
visemes through HeadAudio. Those capabilities map directly to the tutor's
existing audio, timing, state, and interruption contracts.

The walking-skeleton browser proof loaded the optimized model and the adapter
unit tests cover mouth motion, state changes, interruption, retry, and disposal.

## Problem

The current local avatar catalog creates apparent variety without a credible
human teaching experience:

- The SVG and CSS heads are procedural illustrations.
- The Three.js heads are primitive geometry, not rigged avatar models.
- The catalog exposes twelve choices while maintaining three render paths,
  duplicated tests, legacy IDs, and mode-specific UI.
- No GLB, GLTF, VRM, or FBX avatar asset exists in the repository.
- The local paths do not share the visual quality or lip-sync behavior of the
  managed avatar path.

The replacement must improve presence without making a working tutoring
session depend on a paid avatar provider.

## User and job

Primary user: a learner in a live tutoring session.

Job to be done: see a responsive tutor who visibly listens, thinks, speaks,
and stops speaking when interrupted, without waiting for a remote avatar room
or spending provider credits.

Operator job: select one dependable local avatar implementation, retain a
managed-avatar option for premium sessions, and diagnose failures with
provider-specific errors.

## Prior-art review

| Project | Strengths | Constraints | Fit |
| --- | --- | --- | --- |
| [met4citizen/TalkingHead](https://github.com/met4citizen/talkinghead) | MIT; browser-native; active v1.7 streaming API; GLB/Mixamo rigs; ARKit/Oculus visemes; PCM streaming; interruption; audio-driven HeadAudio add-on | Requires a compatible, licensed character model and focused lifecycle/performance validation; no first-party TypeScript types or test suite | Recommended turnkey spike |
| [pixiv/three-vrm](https://github.com/pixiv/three-vrm) + [mrxz/wLipSync](https://github.com/mrxz/wLipSync) | MIT; active VRM loader/runtime; expressions, look-at, spring bones, React/Three compatibility; MFCC/WASM audio lip sync | Lower-level engine; speech streaming, gestures, interruption, and calibrated lip-sync profiles must be assembled in this app | Control benchmark and best long-term ownership |
| [moeru-ai/AIRI](https://github.com/moeru-ai/airi) | MIT; actively maintained browser/self-hosted VRM agent; current use of wLipSync provides a proven reference architecture | Large Vue/Vite monorepo rather than an embeddable React avatar library | Reference implementation only |
| [lipku/LiveTalking](https://github.com/lipku/LiveTalking) | Apache-2.0; higher-fidelity neural digital-human approaches; multiple real-time backends | Server/GPU-heavy, larger operational surface, and weaker match for a zero-credit browser-local fallback | Research track, not MVP |
| Current procedural renderers | Fully local, cheap, deterministic | Low fidelity; three separate renderer families; no real rigged character | Remove after adapter proof |

Offline video generators and GPL-only avatar stacks are excluded from this
slice because the product needs an interruptible live browser session and a
permissive integration path.

## Experience sketch

```text
Avatar picker
  Local Tutor (default)     Simli (managed)     HeyGen (managed)
          |
          v
Session opens
  load licensed GLB -> ready pose -> listening
          |
          v
Learner speaks -> listening expression
Tutor reasons  -> thinking expression
Tutor audio    -> streamed speech + visemes + word timing
Interruption   -> stop audio and animation immediately
          |
          v
Load/runtime failure -> explicit local-avatar error and retry
```

The picker no longer presents “2D” and “3D” as product choices. It presents
one dependable local tutor and separately labels managed providers.

## Architecture contract

Keep the existing `AvatarProviderProps` input stable so the session
controller, gallery, subtitles, and managed branch do not need to change.

The new local adapter accepts:

```ts
type TalkingAvatarAdapterProps = {
  config: {
    provider: "talkinghead";
    modelUrl: string;
  };
  signal: {
    state: "idle" | "listening" | "thinking" | "speaking" | "fading";
    energy: number;
    nowMs: number;
    timestamps: Array<unknown>;
  };
  subtitle?: string;
  variant: "panel" | "hero" | "gallery";
  onError?: (error: Error) => void;
};
```

Required adapter behavior:

- Own and dispose its renderer, animation loop, audio stream, and event
  listeners.
- Map all five existing visual states to an explicit pose or expression.
- Consume the existing timing/energy signal; do not introduce a second tutor
  state machine.
- Support streamed speech, end notification, and immediate interruption.
- Render deterministic loading and error states.
- Expose a stable activity hook for unit and end-to-end tests.
- Never invoke the managed-avatar bootstrap endpoint.

The existing `selectedAvatar.kind === "managed"` boundary remains unchanged
and continues to route Simli/HeyGen through `ManagedAvatarSession`.

## Asset and licensing rule

The engine license does not license a character model. Before production:

1. Select one model with explicit commercial redistribution rights.
2. Record author, source URL, license, modifications, and required attribution.
3. Optimize the asset and measure decoded texture/GPU memory.
4. Keep the model in the repository only if redistribution is permitted;
   otherwise use a documented build/download step and fail clearly when absent.

No placeholder model may be described as production-ready.

## Migration plan

### Slice 1: walking skeleton

- Add the TalkingHead dependency and a single adapter behind the existing
  provider contract.
- Register one local manifest entry and make it the default in a test-only or
  development path.
- Mount a static licensed test model in gallery and session layouts.
- Prove loading, disposal, error handling, and that local selection makes no
  managed-avatar POST.

Proof gate: focused component tests plus one browser session showing the model
in both gallery and session hero. The spike target is under 1.5 seconds to the
first avatar frame, under 150 milliseconds audio-to-mouth skew, at least 30
frames per second during a 60-second turn, and clean renderer/audio disposal
after interruption and route unmount.

### Slice 2: live tutor behavior

- Feed existing state, audio, timing, and interruption signals into the
  adapter.
- Prove `idle -> listening -> thinking -> speaking -> fading`.
- Measure first render, speech start, lip-sync behavior, interruption, memory,
  and frame rate.

Proof gate: recorded local session and automated state/interruption tests.

### Slice 3: migration and removal

- Map every removed local avatar ID to the new local ID in cookie,
  local-storage, lesson-thread, backend persistence, and import paths.
- Remove the legacy SVG, CSS, and procedural Three.js renderers, assets,
  renderer-specific tests, CSS, and unused dependencies.
- Remove the 2D/3D mode toggle and rewrite the avatar catalog around local
  versus managed.
- Preserve Simli/HeyGen managed routing and tests.
- Update architecture, cost, licensing, evaluation, and operator docs.

Proof gate: full frontend verification, focused backend tests, local Playwright
session, and managed-avatar mocked regression.

## Simli incident found during Phase 0

The current Simli failure is not rate limiting.

`livekit-plugins-simli` 1.6.4 appends the default Happy emotion UUID to every
configured face. Simli accepts the current custom face as a raw ID, but both
Happy and Natural emotion-qualified IDs fail the LiveKit integration request
with HTTP 400 and `Character loading crashed`. The repository-default raw face
is also invalid.

The fix must allow a raw face ID, make preflight and worker serialization
identical, propagate the provider 4xx immediately, and show an accurate client
error. Upgrading to plugin 1.6.5 alone is insufficient because the current
upstream serializer still appends an emotion ID.

Implementation and acceptance criteria are tracked in issue #30.

## Risks and open decisions

- Character quality and licensing may be a bigger constraint than the engine.
- Mobile Safari GPU/audio behavior must be tested on a real device.
- HeadAudio quality must be compared with timestamp/viseme-driven animation.
- One model may need lower-resolution textures or a reduced morph-target set.
- Accessibility needs a reduced-motion mode and subtitles independent of the
  3D runtime.
- The adapter spike must establish a measurable fallback/error experience
  before the old renderers are deleted.

## Implementation evidence

- Local default: `nerdy-talkinghead-3d`.
- Licensed model: CC0 `mpfb.glb`, optimized to 2.8 MB with its hierarchy preserved.
- Runtime: `@met4citizen/talkinghead` 1.7.0 with a reproducible Meshopt decoder patch.
- Migration: all twelve removed local IDs resolve to the new local tutor.
- Managed boundary: Simli and HeyGen still route only through `ManagedAvatarSession`.
- Browser proof: the model rendered in the avatar gallery in a real WebGL-capable browser.
- Measured model initialization: `586 ms` in the gallery and `570 ms` in the session, both under the `1.5 s` proof target.
- Playback timing: the avatar clock starts on native audio playback, preserves cumulative offsets across queued segments, resets on interruption, and caps React clock updates near 30 FPS.
- Mobile rendering: effective TalkingHead pixel ratio is capped at `1.5`; the session has 44 px visible touch targets, no 390 px viewport overflow, a non-overlay subtitle row, and a touch-accessible `Stop speaking` action.
- Browser lip-sync proof: the GLB reaches `ready`, advances through multiple active words, produces varied mouth openness, and returns to idle after interruption. Playwright uses an isolated Next.js cache and SwiftShader so a missing WebGL context fails instead of silently passing.
- Automated gates: backend `169 passed`; frontend `45` files / `170` tests plus build and typecheck; focused Playwright `4 passed`; changed-scope React Doctor `100/100` with no issues.
- Remaining proof gaps: physical Mobile Safari, a 60-second FPS/GPU profile, pixel-based mouth-morph timing, and word-accurate visemes for OpenAI Realtime audio that arrives without timestamps.
