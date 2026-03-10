# Full MVP Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining MVP gaps so the tutor has selectable avatar models, explicit text-only and multi-turn lesson UX, cheap offline test coverage, and live benchmark/eval evidence against the full requirements.

**Architecture:** Keep one session spine and one tutor brain. Split avatar selection into two layers: render mode (`2D` or `3D`) and avatar preset (banana, apple, human, etc.). Add a local avatar manifest plus fixture-driven browser test mode so most avatar/session work ships without paid STT/TTS/LLM calls, then reserve live-provider passes for a narrow bakeoff lane.

**Tech Stack:** Next.js 15, React 19, Three.js, FastAPI, WebSocket, Playwright, Vitest, pytest

---

## Recommended Product Shape

### Avatar UX

- replace the current avatar provider buttons with:
  - `Render Mode` dropdown: `2D`, `3D`
  - `Avatar` dropdown: filtered by selected mode
- keep avatar choice in a manifest, not hard-coded branches
- keep `2D` default for baseline demo stability
- treat exact branded/IP characters as non-MVP until rights are clear; use original lookalikes for repo/demo work

### Session UX

- make text-only explicit:
  - primary text action: `Send Text Turn`
  - mic remains separate: `Start Mic` / `Stop Mic`
- add `New Lesson`
- add visible conversation history
- keep same websocket session for follow-up turns
- add a server reset event so `New Lesson` truly clears history/context

### Cheap Test Strategy

- default test lane uses:
  - local fixture transport
  - canned timestamps/audio metadata
  - local `glb` / CSS avatar assets
  - Playwright smoke matrix across avatar presets
- paid-provider lane runs only after fixture mode is green
- limit live bakeoff to:
  - 1 short voice
  - 3 canned prompts
  - 1 chosen STT + 1 chosen TTS + primary LLM

### Cost Guardrails

- cheapest categories:
  - local CSS / local `glb` avatar assets
  - STT by minute
  - TTS by character
- most expensive categories:
  - real-time speech-to-video avatar vendors
  - custom avatar training / photoreal avatar slots
  - rendered video generation
- working rule:
  - default all local/dev/browser tests to fixture mode
  - use local assets for avatar bakeoffs
  - use live STT/TTS only in a tiny benchmark lane
  - defer Simli / HeyGen avatar spend until the local avatar/session UX is stable

### Asset Recommendation

- cheapest safe local test assets:
  - Khronos glTF sample assets for runtime correctness testing
  - Poly Haven CC0 models/textures for higher-quality neutral assets
  - Kenney CC0 assets for stylized low-poly placeholder characters
  - Fab free assets only when license is pinned in repo notes
- recommended starter local presets:
  - `banana`
  - `talking-apple`
  - `stylized-human`
  - `robot-tutor`
  - `wizard-school-inspired` original
  - `yellow-minion-inspired` original
- avoid building dependency on Ready Player Me; their public update says services became unavailable on January 31, 2026

Sources:

- Poly Haven license: https://polyhaven.com/license
- Kenney asset licensing FAQ: https://kenney.nl/support
- Fab standard license summary: https://www.fab.com/eula
- Khronos glTF sample assets: https://github.com/KhronosGroup/glTF-Sample-Assets
- Ready Player Me update: https://forum.readyplayer.me/t/an-important-update-from-ready-player-me/3706

## Lane Split

### Lane A: Avatar Catalog and Selector UX

**Goal:** Make avatar switching easy, visible, and provider-agnostic.

**Files:**
- Modify: `frontend/components/TutorSession.tsx`
- Modify: `frontend/components/AvatarProvider.tsx`
- Modify: `frontend/components/avatar_registry.ts`
- Create: `frontend/components/AvatarSelector.tsx`
- Create: `frontend/lib/avatar_manifest.ts`
- Test: `frontend/components/AvatarSelector.test.tsx`
- Test: `frontend/components/TutorSession.test.tsx`

**Steps:**
1. Write failing tests for `Render Mode` + `Avatar` dropdown behavior.
2. Move avatar options into a manifest with `id`, `label`, `mode`, `assetRef`, `status`.
3. Add dropdown UI and preserve lazy 3D loading.
4. Run unit tests and build.

### Lane B: Local Avatar Assets and Runtime Adapters

**Goal:** Support multiple cheap avatars without provider spend.

**Files:**
- Create: `frontend/public/avatars/README.md`
- Create: `frontend/public/avatars/*.glb`
- Modify: `frontend/components/Avatar3D.tsx`
- Modify: `frontend/components/AvatarRenderer.tsx`
- Create: `frontend/lib/avatar_asset_loader.ts`
- Test: `frontend/lib/avatar_asset_loader.test.ts`

**Steps:**
1. Add manifest-backed local test assets for banana, apple, human, and 1-2 stylized originals.
2. Make 2D skins and 3D assets resolve through one asset loader.
3. Add fallback silhouette asset if a selected model fails to load.
4. Validate `glb` assets before use.

### Lane C: Lesson Session UX and Text-Only Flow

**Goal:** Make the tutoring loop feel like a lesson, not a one-shot demo.

**Files:**
- Modify: `frontend/components/TutorSession.tsx`
- Create: `frontend/components/ConversationHistory.tsx`
- Modify: `frontend/lib/session_socket.ts`
- Modify: `backend/session/server.py`
- Modify: `backend/turn_taking/controller.py`
- Test: `tests/session/test_server_pipeline.py`
- Test: `frontend/components/TutorSession.test.tsx`

**Steps:**
1. Write failing tests for `Send Text Turn`, `New Lesson`, and visible history.
2. Add a backend `session.reset` event that clears history and profile state.
3. Add a frontend history panel and explicit follow-up turn flow.
4. Verify a follow-up question actually uses prior turn context.

### Lane D: Offline Browser Smoke Matrix

**Goal:** Prove the avatar/session UX works without spending credits.

**Files:**
- Create: `frontend/lib/fixture_transport.ts`
- Modify: `frontend/playwright.config.ts`
- Create: `frontend/e2e/avatar-matrix.spec.ts`
- Create: `frontend/e2e/text-lesson.spec.ts`
- Create: `frontend/e2e/new-lesson.spec.ts`

**Steps:**
1. Add a fixture transport mode with deterministic transcript, reply, timestamps, and avatar config.
2. Run Playwright against fixture mode by default in CI/local smoke.
3. Add a matrix over multiple avatar presets and both render modes.
4. Capture screenshots/video for reviewer packaging.

### Lane E: Live Provider Bakeoff and Latency Closure

**Goal:** Replace synthetic confidence with bounded live evidence.

**Files:**
- Modify: `backend/benchmarks/*`
- Modify: `docs/planning/benchmark-report-v1.md`
- Modify: `docs/requirements-trace.md`
- Modify: `frontend/components/LatencyMonitor.tsx`
- Test: `tests/benchmarks/*`

**Steps:**
1. Add live vs fixture benchmark modes.
2. Run 3 canned prompts with one low-cost provider stack.
3. Record `speech_end`, `stt_final`, `llm_first_token`, `tts_first_audio`, `first_viseme`, `audio_done`.
4. Update pass/fail table against hard requirements.

### Lane F: Pedagogy, Eval, Demo, Acceptance

**Goal:** Close the final judging artifacts.

**Files:**
- Modify: `docs/EVAL.md`
- Modify: `docs/demo-script.md`
- Modify: `docs/demo-operator-notes.md`
- Modify: `docs/submission-checklist.md`
- Create: `eval/fixtures/multi_turn/*.json`

**Steps:**
1. Add multi-turn lesson fixtures for math, science, and English.
2. Score Socratic quality, scaffolding, correction style, grade fit, and lesson arc.
3. Lock demo concepts and avatar presets.
4. Record acceptance evidence checklist.

### Lane G: Provider Cost and Asset Licensing Guardrails

**Goal:** Keep experimentation cheap and legally safe before premium avatar vendors enter the stack.

**Files:**
- Create: `docs/avatar-costs-and-licensing.md`
- Modify: `docs/cost-performance.md`
- Modify: `docs/submission-checklist.md`
- Create: `frontend/public/avatars/ATTRIBUTION.md`

**Steps:**
1. Record approved local asset sources and banned IP-sensitive presets.
2. Add a monthly burn cap and per-lane spend rule.
3. Define when Simli / HeyGen are allowed in testing.
4. Add a reviewer-facing note separating placeholder originals from licensed third-party assets.

## Parallelization

Can run in parallel now:

- Lane A and Lane C after the manifest/session contract is frozen
- Lane B and Lane D once Lane A manifest shape lands
- Lane F can start on eval fixtures immediately
- Lane G can start immediately

Do not parallelize yet:

- WebSocket event renames
- avatar manifest schema churn
- session reset semantics
- live provider benchmark contract
- asset licensing exceptions

## My 3 Steps

1. Ship the avatar manifest plus dropdown selector so switching 2D/3D and individual models is trivial.
2. Ship explicit lesson UX: text-only send, follow-up history, and `New Lesson`.
3. Ship offline smoke matrix first, then a tiny live bakeoff to prove latency and session quality.
