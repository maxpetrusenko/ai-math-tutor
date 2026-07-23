---
title: Avatar voice, lip sync, and latency Phase 0
date: 2026-07-22
status: approved-by-user-request
read_when:
  - changing avatar choices, voice routing, lip sync, or latency gates
---

# Avatar voice, lip sync, and latency Phase 0

## User problem

The tutor can change voice identity between turns or even phrases, the current mouth motion reads as one open/close gesture instead of speech, and the avatar menu still promotes managed providers that are not part of the dependable local product.

## Observed baseline

- Before this slice, the visible catalog contained one local TalkingHead tutor plus Simli and HeyGen managed entries.
- The twelve former procedural avatar IDs are migration aliases to the one local tutor. They are not distinct current avatars.
- Cartesia's current default voice ID, `694f9389-aac1-45b6-b726-9d9369183238`, resolves to `Sarah - Mindful Woman` in Cartesia's live catalog.
- When Cartesia synthesis fails, the backend silently emits a text-only segment. The browser then chooses an unpinned system speech voice. This can change voice identity inside one tutor reply.
- MiniMax speech is currently a text-only stub and also reaches browser speech fallback.
- Before this slice, OpenAI Realtime was pinned separately to `marin`.
- Realtime PCM is buffered for playback, but only approximate transcript timestamps reach the avatar. Actual audio energy does not.
- The browser avatar clock runs at 30 updates per second. TalkingHead morph transitions are set to 45 ms.
- Fresh 90-run fixture benchmark: speech-to-STT p50/p95 125/135 ms; speech-to-first-audio 455/495 ms; speech-to-first-viseme 490/505 ms; audio complete 1245/1305 ms.
- The fixture can report `tts_first_audio -> first_viseme = -20 ms`, proving the current synthetic timing is not monotonic.
- Current runtime/browser “first viseme” means playback started, not that a visible mouth change was measured.

## Product decisions

1. **Local-only avatar menu.** Remove Live avatars and render-mode controls from user-facing avatar selection. Keep managed provider code isolated for future experiments; do not delete it in this change.
2. **One current tutor identity.** The shipped catalog has one local model, so this change must not claim that female, male, or child avatar variants currently exist.
3. **Future-safe voice presentation.** Every selectable avatar manifest entry must declare an age/gender presentation profile. Voice resolution must use that profile and the active provider, never a provider-global or browser default.
4. **Current Nerdy voice.** The model visually presents as a young adult woman. Pin Cartesia `Skylar - Friendly Guide` and OpenAI Realtime `marin`. Never switch to an arbitrary browser voice mid-turn.
5. **No silent identity switch.** If live provider audio fails, surface the playback failure. Do not replace a phrase with a different browser voice.
6. **Phoneme-driven articulation.** Convert each timed word into English visemes and coarticulate them into 75 ms minimum visible holds that survive the 30 FPS render cadence. PCM energy remains a fallback when a timed cue is unavailable.
7. **Honest latency names.** Separate `playback_started` from `first_mouth_motion`. A lip-sync gate must use observed mouth motion or a deterministic audio-envelope test, not playback start.

## Voice matrix contract

| Avatar presentation | Cartesia | OpenAI Realtime | Browser fallback |
| --- | --- | --- | --- |
| adult masculine | explicit masculine voice ID | explicit stable voice | disabled for provider turns |
| adult feminine | explicit feminine voice ID | explicit stable voice | disabled for provider turns |
| child masculine | explicit provider voice with child/young metadata | explicit reviewed voice | disabled for provider turns |
| child feminine | explicit provider voice with child/young metadata | explicit reviewed voice | disabled for provider turns |

Only `adult feminine` is instantiated by the current catalog. New avatar assets must add reviewed provider voice IDs before they become selectable.

## Lip-sync design

- Import TalkingHead's English processor explicitly so Next.js bundling cannot break its package-relative dynamic import.
- Convert timed words to the GLB's Oculus viseme morphs.
- Coarticulate one to three representative shapes per word with at least 75 ms of visible time.
- Sample and apply morph values every 20 ms; the model renders at 30 FPS.
- Silence and interruption clear all active visemes.
- Preserve PCM energy mouth motion only when timed word cues are unavailable.
- Keep one audio owner. `AudioPlayer` remains responsible for playback; TalkingHead receives morph values only.

## Updated gates

### Voice

- Same avatar and provider resolve the same voice on every turn.
- Provider errors cannot switch to another voice inside the turn.
- Current Nerdy Cartesia voice metadata is feminine, English, and suitable for guidance.
- Future avatar entries cannot be selectable without a voice-presentation profile.

### Lip sync

- The shipped GLB exposes the required English viseme morph targets.
- One browser utterance renders at least three distinct non-zero viseme morphs.
- Mouth closes during silence and interruption.
- Envelope window plus morph smoothing stays below 100 ms, with 150 ms as the absolute spike ceiling.
- Browser proof samples repeated mouth transitions while real provider audio plays.

### Latency and rendering

- Speech-to-STT final: p95 <= 350 ms.
- Speech-to-first-audio: p50 <= 500 ms and p95 <= 900 ms.
- Audio-to-first-mouth-motion: p95 <= 80 ms, target <= 45 ms.
- Benchmark events must be monotonic; negative stage durations fail the run.
- TalkingHead sustained animation: p50 >= 30 FPS over 60 seconds, with long-frame rate reported.
- Local `/session`, `/avatar`, and backend API remain reachable.

## Walking skeleton

1. Add tested word-to-viseme scheduling and pass it through one playback turn to TalkingHead.
2. Hide managed choices and migrate stale managed preferences to the local tutor.
3. Add deterministic avatar-to-provider voice resolution and prevent silent provider-to-browser switching.
4. Repair benchmark monotonicity and add truthful audio-to-mouth gates.
5. Run focused tests, full gates, live runtime benchmark, mobile/browser QA, and React Doctor.

## Constraints and non-goals

- No new avatar models in this change.
- No deletion of managed avatar backend/provider code.
- The browser now renders distinct word-timed phoneme shapes; exact provider-audio onset alignment remains separately measured by the latency lane.
- No production deploy, commit, or push without separate approval.
- Public Gemini comparison benchmark requires a Gemini key and is not a blocker for the shipped local runtime benchmark.
