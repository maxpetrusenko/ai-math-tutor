---
date: 2026-06-29T15:12:28-0400
researcher: Codex
git_commit: 8e359dde1eb6bb560261435b1ee1a83b67b2bb14
branch: main
repository: ai-math-tutor
topic: "Simli Voice And Lipsync Recovery Plan"
tags: [implementation, strategy, livekit, simli, avatar-worker, realtime-audio]
status: complete
last_updated: 2026-06-29
last_updated_by: Codex
type: implementation_strategy
---

# Handoff: Simli voice and lipsync recovery

## Task(s)

- Completed: deployed and verified a hosted Simli managed-avatar path on `https://aitutor.maxpetrusenko.com/session`.
- Completed: fixed the first-order race where the browser could open the mic before the backend avatar agent was actually ready.
- Completed: verified one hosted run where the frontend reached `agent.ready`, the worker transcribed `What is 2 plus 2?`, OpenAI realtime generated a reply, and Simli emitted playback-finished metrics.
- Not complete: the user-visible proof is still not sufficient for "voice + lipsync are connected" because the Playwright recording is video-only and the frontend does not prove that the audible track comes from the avatar participant, not the raw agent/model participant.
- Not complete: the fix is not verified across all managed avatar providers or all model/voice selections.
- Not complete: production worker deployment is not durable through Coolify. The current worker was swapped manually on Contabo after Coolify returned `Server is not functional`.

## Critical References

- `backend/livekit/avatar_agent.py`
- `backend/livekit/avatar_bootstrap.py`
- `frontend/components/ManagedAvatarSession.tsx`
- `docs/livekit-managed-avatars.md`

## Recent changes

- `backend/livekit/avatar_agent.py`: added `student_identity` input targeting, agent-ready LiveKit data packet, and session event logging.
- `frontend/components/ManagedAvatarSession.tsx`: added `agentReady` state and gated mic controls until `nerdy.avatar_agent.ready`.
- `frontend/components/session/TutorSessionComposer.tsx`: surfaced `waiting for tutor` / `tutor ready` and disabled mic until agent ready.
- `.github/workflows/fast-coolify-deploy.yml`: added avatar-worker to deploy matrix and disabled HTTP health checks for it.

Commit containing these changes: `8e359dde1eb6bb560261435b1ee1a83b67b2bb14`.

## Learnings

- LiveKit Simli plugin behavior matters: `simli.AvatarSession.start()` can log provider failures such as `failed to connect to simli avatar session server returned 429` and return without raising. The worker currently continues anyway.
- When Simli start fails this way, `AgentSession` can still start and publish raw model audio through normal room output. That creates the exact failure mode Max is calling out: model voice exists, but it is not guaranteed to be routed through Simli lipsync.
- Worker logs from the good hosted run showed `audio_output_chain: ["TranscriptSynchronizer", "AudioSinkProxy", "DataStreamIO"]`, which indicates the Simli data-stream audio route was active.
- Worker logs from a bad/rate-limited run showed `audio_output_chain: ["TranscriptSynchronizer", "AudioSinkProxy", "RoomIO"]`, which indicates fallback/raw room output and should be treated as failed, not ready.
- The frontend attaches the first remote video track and first remote audio track without validating participant identity. It needs explicit participant filtering and visible diagnostics.
- The hosted connect path still has high initial latency, roughly 13 seconds to `agent.ready` in the latest proof. Once input reached the model, OpenAI realtime TTFT was around 0.357 seconds and Simli playback latency around 0.313 seconds.
- The current proof artifacts are under `/Users/maxpetrusenko/Desktop/ai-tutor-proof/`. They include a captioned social clip, but no captured tab audio.

## Artifacts

- `/Users/maxpetrusenko/Desktop/ai-tutor-proof/ai-tutor-simli-social-2plus2-2026-06-29.mp4`
- `/Users/maxpetrusenko/Desktop/ai-tutor-proof/ai-tutor-simli-2plus2-hosted-2026-06-29.mp4`
- `/Users/maxpetrusenko/Desktop/ai-tutor-proof/social-poster-frame.png`
- `/Users/maxpetrusenko/Desktop/ai-tutor-proof/frame-agent-ready.png`
- `/Users/maxpetrusenko/Desktop/ai-tutor-proof/frame-reply-window.png`

## Proposed Recovery Plan

Mini Claude reviewed this plan on `mini` via:

```bash
ssh mini 'zsh -lc "claude -p ... < /tmp/ai-tutor-simli-voice-lipsync-plan.md"'
```

It agreed with the core diagnosis but raised four corrections:

- Do not use `audio_output_chain` class-name matching as the primary health contract. Use room state and participant identity.
- Move durable deploy ahead of hosted proof. Proof from a manual Docker swap is not enough.
- Treat Simli `429` as likely leaked/zombie sessions or shared-key concurrency until proven otherwise.
- Prove audible track identity, not mouth pixels. If audio and video come from the avatar participant and raw model audio is disabled, lipsync is structurally enforced by the provider.

### Phase 0: topology and deploy truth

Acceptance: the team can state exactly which LiveKit participant publishes avatar audio/video and every proof references a redeployable image SHA.

Actions:
- Document actual Simli topology from a live room: participant identities, track kinds, track sources, publication names, and whether the agent participant publishes audio.
- Fix Coolify worker deployment failing with `Server is not functional` before trusting more production proof.
- Stamp runtime image/revision for web, session, and avatar-worker in a public or authenticated status endpoint.
- Re-run proof only after the worker is deployed through the normal path, not manual `docker run`.

### Phase 1: fail-closed voice/lipsync gate

Acceptance: `agent.ready` is published only after the expected avatar participant has published both audio and video, and the user can never hear raw model audio if avatar routing fails.

Actions:
- Configure deterministic avatar participant identity, for example `avatar-simli`, in `simli.AvatarSession(...)`.
- Return expected `avatar_participant_identity` from `create_avatar_room_session`.
- Disable model-to-room audio whenever a managed avatar is active. The only audible track should be the avatar participant's audio track.
- Wait server-side for expected avatar participant audio+video track publications before publishing `agent.ready`.
- If Simli fails or returns 429: close the room, attempt one bounded retry with backoff, then surface a retryable provider error. Do not start a raw-audio fallback.
- Add teardown on every exit path and log room/session cleanup.

### Phase 2: frontend identity-scoped media

Acceptance: frontend attaches only audio/video from the expected avatar participant and shows source-specific readiness.

Actions:
- In `ManagedAvatarSession.tsx`, attach remote video/audio only from that identity.
- Log ignored tracks from non-avatar participants for debugging.
- Mark `Live` only when `agentReady`, expected avatar video, and expected avatar audio are attached.
- Show separate states: `video live`, `audio live`, `tutor ready`, `speaking`, and `provider retrying`.

### Phase 3: root-cause Simli 429

Acceptance: a single-user demo does not hit 429 after cleanup and bounded retry are implemented.

Actions:
- Audit room lifecycle and Simli session lifecycle under fast retries and browser reloads.
- Count active LiveKit rooms and active Simli sessions where possible.
- Verify `Leave`, tab close, timeout, provider failure, and test abort all clean up the same way.
- Add concurrency guard so repeated clicks/reloads cannot create overlapping Simli sessions on one user flow.

### Phase 4: latency budget

Acceptance: the 13-second ready time is attributed and either reduced or explicitly deferred with a target.

Actions:
- Add timestamps for API bootstrap start/end, room create, dispatch create, worker job received, avatar start, avatar A/V published, agent ready, mic enabled, transcript final, model TTFT, playback start/end.
- Split latency into Coolify/container cold start, LiveKit dispatch, Simli connect, OpenAI realtime connect, and frontend media attach.
- Set a near-term target, for example `<5s warm ready`, `<10s cold ready`, or document why Simli provider latency prevents it.

### Phase 5: reproducible proof bundle

Acceptance: proof verifies voice, lipsync route, and failure behavior against a normal deployed SHA.

Actions:
- Replace Playwright video-only proof with tab/system-audio capture or LiveKit egress recording.
- Capture a positive run with real audio and a timeline:
  - navigation start
  - room created
  - avatar A/V attached from expected identity
  - no raw agent audio track attached
  - agent.ready
  - mic open
  - final transcript
  - assistant text
  - speaking start/end
  - playback finished
- Capture a negative run where Simli attach is forced to fail or mocked to fail; expected result is silence plus retryable error.
- Optional: keep mouth-frame screenshots for social proof, but do not treat pixel deltas as the source of truth.

### Phase 6: model/provider matrix

Acceptance: no claim of "all connected models" until this matrix passes.

Minimum matrix:
- Simli + OpenAI realtime voice `alloy`
- Simli + each configured OpenAI realtime voice exposed in the app
- HeyGen/LiveAvatar + OpenAI realtime
- Any non-realtime model path that still uses separate TTS must be excluded from managed-avatar claims unless it routes audio through avatar output.

For each row record:
- connect time to avatar video
- time to agent ready
- transcript final time
- TTFT
- playback start/finish
- audio/video source identity
- proof that raw agent audio is not attached
- proof video path

## Action Items & Next Steps

1. Fix Coolify avatar-worker deploy durability and runtime SHA reporting.
2. Document LiveKit room topology for a Simli run.
3. Add deterministic avatar participant identity in `backend/livekit/avatar_agent.py` / `backend/livekit/avatar_bootstrap.py`.
4. Disable raw model-to-room audio for managed avatars.
5. Gate `agent.ready` on expected avatar participant A/V track publication.
6. Filter frontend media attachment by expected avatar identity.
7. Add Simli 429 lifecycle cleanup and one bounded retry.
8. Add regression tests for provider-start failure, 429 path, frontend filtering, and mid-session avatar track drop.
9. Build proof runner that captures browser audio or LiveKit egress.
10. Run positive and negative hosted proof on a normal deployed SHA.
11. Only then expand to HeyGen/LiveAvatar and all configured model/voice rows.

## Other Notes

- Current hosted containers were verified at image `sha-8e359dde1eb6bb560261435b1ee1a83b67b2bb14`.
- Current worker container name during proof: `yw36ciy2dqqcq9ituuwzdsru-manual-8e359dde`.
- Latest good proof room: `nerdy-simli-ae07ea4069c0`.
- Latest good worker evidence:
  - `avatar agent ready published`
  - final transcript included `What is 2 plus 2?`
  - `avatar agent state changed` from `listening` to `speaking`
  - realtime metrics showed `ttft: 0.3573038578033447`
  - `playback finished event received`
  - assistant text: `Two plus two is four. Great job asking that! ...`
