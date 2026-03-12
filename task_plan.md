# Session Surface Split Plan

## Goal

Keep the approved `radiant-lessons-hub` `/tutor` visual system on Nerdy `/session`, but make `/session` stage-only: avatar, chat, composer, and history. Move editable lesson, avatar, model, and audio defaults onto their dedicated pages.

## Phases

| Status | Phase | Notes |
| --- | --- | --- |
| complete | Audit live repo vs reference | Confirmed root `main` still serves old session; `/tutor` reference is the approved target |
| complete | Design approval | User selected exact `/tutor` shell with real avatar/session logic preserved |
| complete | Test-first shell coverage | Added `frontend/components/TutorSessionShell.test.tsx` and aligned `TutorSession` behavior tests with the stage-only shell |
| complete | Cross-page preference wiring | Added shared session preference storage and moved editable defaults to `/lessons`, `/avatar`, `/models`, and `/settings` |
| complete | Implementation | Rebuilt `/session` as avatar stage plus chat plus history only, with setup links to the dedicated pages |
| complete | Verification | Focused session tests passed; full `pnpm verify` passed in `frontend/` |

## Constraints

- No emoji UI
- Use the served repo on `main`; user is testing `127.0.0.1:3000`
- Match the `/tutor` page composition, not the previous custom session studio draft
- Do not leave lesson, avatar, model, or audio settings inline on `/session`
- Save progress in task files and update each step
- Preserve existing Next.js app/router structure and all existing tutor behaviors

## Open Questions

- None

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Visual mismatch between tested code and served app | 1 | Confirmed `main` serves old `TutorSession`; porting approved design directly into the served repo |

## Outcome

- `/session` now uses the approved `/tutor` style composition in the served repo on `main`
- `/session` is reduced to avatar hero, transcript bubbles, compact composer, quick setup links, and overlay history drawer
- Shared preferences persist across `/lessons`, `/avatar`, `/models`, `/settings`, and hydrate back into fresh or restored sessions
- Verified against the served route and the frontend gate

## Final Pass

- Removed inline settings cards from `/session`
- Added shared `session_preferences` storage for lesson, runtime, and audio defaults
- Wired `/lessons`, `/avatar`, `/models`, and `/settings` to update those defaults
- Added deterministic session tests with explicit storage resets between files

## 2026-03-12 Follow Up Plan

### Goal

Close the remaining gap between "works" and "10/10":
- every turn keeps rich debug after persistence and reload
- every session exposes readable connection history in UI
- realtime turns explain their limits honestly
- 2D, 3D, and managed avatars each feel deliberate, low-latency, and demo-ready

### Current Status Snapshot

| Category | Status | Gap to 10/10 |
| --- | --- | --- |
| Turn debug persistence | mostly complete | old sessions already degraded to legacy fallback cannot be recovered |
| Session logs UI | complete first pass | needs export/copy/filter and clearer grouping by reconnect cycle |
| OpenAI realtime trace fidelity | partial | no provider timestamps, no streamed text chunk display, latency labels too easy to misread |
| 2D avatars | strong | can feel less alive during idle/listen/think transitions |
| 3D avatars | strong | needs stronger fallback loading states and slightly richer mouth/attention cues |
| Simli managed avatar | strong | reconnect/disconnect diagnostics and session retry ergonomics still thin |
| LiveAvatar path | blocked externally | auth + provider path not production-ready locally |

### Detailed Phases

| Status | Phase | Notes |
| --- | --- | --- |
| complete | Recover debug persistence root cause | backend archive/read path dropped nested `debug` payloads from turns |
| complete | Add regression for persisted turn debug | backend test now proves active + archived debug survives writes and reloads |
| pending | Realtime debug fidelity pass | make `openai-realtime` debug explicit about missing timestamps and chunk semantics |
| pending | Realtime text streaming pass | surface partial/final text progression so replies do not feel like opaque single blobs |
| pending | Logs drawer quality pass | add reconnect grouping, copy/export, and top-level issue markers |
| pending | 2D polish pass | stronger idle/listening/speaking choreography, subtitle pacing, hover-preview consistency |
| pending | 3D polish pass | loading/failure fallbacks, better conversational staging, animation continuity |
| pending | Simli resilience pass | better reconnect UX, retry controls, failure taxonomy, stream-attach diagnostics |
| pending | LiveAvatar readiness decision | either remove from primary UX until valid key exists or complete a separate provider-ready path |
| pending | End to end verification | browser runs for local avatars + Simli + restored lesson debug + disconnect logging |

### Requirement Mapping

#### Debug + logs
- Each move must persist `debug`
- Each move should include recent `sessionEvents`
- History drawer must never show "Debug unavailable" for any new turn
- Logs drawer should expose connection timeline readable by AI and humans

#### OpenAI realtime
- Show honest capability state:
  - timestamps supported: no
  - streamed text chunks: not yet
  - audio returned: yes
- Avoid "complete" language if provider-level timestamps are absent
- Add chunk counters so raw trace explains whether response was one final segment or streamed pieces

#### 2D avatar category
- faster hover/selection greeting loops
- stronger thinking/listening visual distinction
- subtitle and mouth timing align on short replies
- no dead-card feel in selection grid

#### 3D avatar category
- stable loading skeleton
- clearer fallback when model/chunk load fails
- preserve session continuity during mode changes
- improve idle attention and speaking transitions

#### Managed avatar category
- Simli:
  - retry button behavior
  - reconnect timeline in logs
  - attach-state observability
  - clearer "room live / waiting for stream / stream attached / disconnected" ladder
- LiveAvatar:
  - isolate as blocked provider path until valid key
  - do not present as equal-quality ready option until auth is real

### Technical Work Items

1. Realtime transport observability
   - add `providerTimestampSupport`, `textChunkCount`, `audioChunkCount`, `responseAssemblyMode`
   - change debug coverage labeling for realtime turns
   - preserve session log snapshot on final resolve
2. Realtime UX
   - decide whether to stream partial tutor text into conversation UI
   - if no provider word timings, show explicit `No word timestamps from provider`
3. Logs drawer
   - add reconnect session boundaries
   - add copy/export logs
   - add severity and filter chips
4. 2D or 3D polish
   - tighten animation states
   - align preview language and hover behavior
   - harden asset failure fallback
5. Managed avatar resilience
   - record room join, remote participant, track subscribe, track unpublish, disconnect reason
   - attach those to turn/session debug
6. LiveAvatar product decision
   - either hide/flag as blocked
   - or complete only after valid provider credentials

### Risks

- old degraded turns cannot be reconstructed if no turn trace exists
- realtime provider may never offer usable word timestamps through current path
- managed avatar reliability still depends on external provider rate limits/session limits

### Success Criteria

- new turns retain full debug after refresh, archive, resume
- logs drawer explains disconnects without devtools
- realtime trace no longer looks misleading
- 2D, 3D, and Simli demos each feel stable and intentional
- LiveAvatar is either genuinely ready or clearly labeled blocked
