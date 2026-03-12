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
