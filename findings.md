# Findings

## Session Port Target

- The user approved the exact `/tutor` visual direction from `radiant-lessons-hub`
- The served app at `http://127.0.0.1:3000/session` is running from `/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy` on branch `main`
- The redesign previously implemented in `.worktrees/radiant-redesign` is not what the user wants for `/session`; `/tutor` is the source of truth

## Reference Tutor Page

- `/Users/maxpetrusenko/Desktop/Projects/oss/radiant-lessons-hub/src/pages/TutorSession.tsx` uses a simple centered composition:
  - compact header row
  - avatar display card
  - scrollable chat area
  - tight mic/input/send row
- `/Users/maxpetrusenko/Desktop/Projects/oss/radiant-lessons-hub/src/components/DashboardLayout.tsx` keeps the session inside the shared app shell, which matches the rest of Nerdy's redesigned pages

## Final Session Resolution

- `/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/components/TutorSession.tsx` now uses the approved dashboard shell composition instead of the old full-height rail
- The served page now renders:
  - compact `Tutor Session` header
  - hero avatar panel powered by `AvatarProvider`
  - chat bubble transcript panel
  - tight mic/input/send composer
  - quick links to `/lessons`, `/avatar`, `/models`, `/settings`
  - overlay history drawer
- Existing runtime, mic, persistence, lesson restore, and latency behaviors remained intact through the port
- Editable setup now lives on the dedicated pages:
  - `/lessons` writes subject, grade, and lesson preference defaults
  - `/avatar` writes avatar preference
  - `/models` writes runtime defaults
  - `/settings` writes learning preference and audio volume defaults
- `/session` hydrates those defaults through `frontend/lib/session_preferences.ts`

## Current Nerdy Frontend

- Next.js 15 app router; no shadcn setup in `frontend/`
- Custom CSS variables in [`frontend/app/globals.css`](/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend/app/globals.css)
- Existing dashboard shell uses bespoke SVG icons, inline styles, and mock lesson/dashboard data
- Session page already connects to real `TutorSession` and persisted lesson thread store

## Reference Repo: radiant-lessons-hub

- Vite app, not Next.js; should copy design system ideas, not routing/file structure
- Has `components.json`, shadcn ui primitives, Tailwind, lucide-react
- Strong reusable patterns: `Card`, `Button`, `Badge`, `Input`, sidebar primitives
- Also still contains some emoji in content/mock data, so reference needs cleanup during port

## Verification Evidence

- `pnpm vitest run lib/session_preferences.test.ts components/TutorSessionShell.test.tsx components/TutorSessionComposer.test.tsx components/TutorSession.test.tsx` passed
- `pnpm verify` passed in `/Users/maxpetrusenko/Desktop/Gauntlet/Nerdy/frontend`
- `curl http://127.0.0.1:3000/session` from the served app now returns the new shell markup, including `Tutor Session`, `session-hub`, and the compact composer placeholder

## Debugging Notes

- Cross-file test runs leaked localStorage and persisted lesson state into `TutorSession.test.tsx`
- Adding an explicit `beforeEach` reset for localStorage, cookie avatar preference, and active lesson persistence made the session suite deterministic
- Backend 3D avatar payloads use `provider: "threejs"`; tests using `provider: "human"` were invalid and hid the real behavior
