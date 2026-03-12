# Progress Log

## 2026-03-11

- Confirmed the served app is the root repo on `main`, not the `radiant-redesign` worktree
- Compared root `frontend/components/TutorSession.tsx` against the approved `/tutor` reference page
- Locked the new direction: exact `/tutor` visual shell on `/session`, real avatar/session logic preserved, setup moved off-page
- Added a shell regression in `frontend/components/TutorSessionShell.test.tsx` before the layout port
- Rebuilt the served `TutorSession` shell inside `DashboardLayout` and replaced the old rail with:
  - hero avatar card
  - transcript bubble panel
  - tight mic/input/send composer
  - quick setup links
  - overlay history drawer
- Added served repo CSS for the new `session-hub` layout in `frontend/app/globals.css`
- Verified rendered server output from `http://127.0.0.1:3000/session` contains the new session shell markup
- Passed:
  - `pnpm vitest run components/TutorSessionShell.test.tsx`
  - `pnpm vitest run components/TutorSession.test.tsx`
  - `pnpm verify` in `frontend/`
- Completed the page split after live review:
  - removed inline settings cards from `/session`
  - added `frontend/lib/session_preferences.ts`
  - wired `/lessons`, `/avatar`, `/models`, and `/settings` to shared defaults
  - kept avatar, chat, composer, and history only on `/session`
  - added provider-audio fallback to speech synthesis on playback rejection
  - hardened session tests against cross-file storage bleed with explicit resets
- Added regression coverage in `frontend/components/AudioPlayer.test.tsx` for rejected provider audio playback
