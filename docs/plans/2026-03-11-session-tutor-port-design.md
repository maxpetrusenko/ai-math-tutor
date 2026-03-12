# Session Tutor Port Design

**Goal**

Port the visual composition of `radiant-lessons-hub` `/tutor` onto Nerdy `/session` without removing any of Nerdy's real tutor capabilities, while moving editable setup off the session page.

**Status**

- Achieved in the served repo on `main`

**Approved Direction**

- Use the shared app shell already used by the redesigned dashboard and lessons pages
- Match the reference `/tutor` page structure:
  - compact session header
  - large avatar card
  - chat transcript area
  - tight mic and send composer row
- Replace the owl placeholder with Nerdy's live `AvatarProvider`
- Keep Nerdy's real mic flow, persisted conversation, lesson restore, history access, and latency display
- Move editable lesson, avatar, model, and audio setup to the dedicated pages

**Design Decisions**

- Primary stage becomes a single centered conversation studio rather than the old full-height left rail
- Advanced controls should leave the page entirely if they disrupt the approved `/tutor` composition
- Conversation history stays accessible but should not dominate the default view
- Copy and spacing should harmonize with the rest of the redesigned Nerdy pages

**Implemented Notes**

- The final shell uses the shared `DashboardLayout`
- The avatar hero is the real `AvatarProvider`, not a placeholder block
- Conversation turns render as student/tutor bubbles in the main panel
- History moved to an overlay drawer so the default viewport stays aligned with other redesigned pages
- `/session` now shows setup links instead of inline controls
- Session defaults persist through shared client storage and hydrate into fresh lessons
- Audio now uses saved default volume and falls back to speech synthesis if provider audio playback is blocked

**Non Goals**

- Do not recreate the exact Vite shadcn component tree
- Do not remove any existing session capabilities
- Do not change routing or lesson persistence behavior
