# UI 90 Upgrade Design

## Goal

Raise the seven core product pages to a consistent `90+` quality bar without losing the real Nerdy features that already beat the `radiant-lessons-hub` mock.

## Product direction

Keep the current Nerdy-specific depth on:

- `/session`
- `/models`
- `/avatar`

Do not flatten those pages into screenshot-only clones. Instead:

- keep the real runtime, audio, avatar, and persistence behavior
- improve visual hierarchy, product framing, and polish
- add missing learner-facing features from the reference where they strengthen the product

## Design principles

1. `Shell first`
   Fix shared shell, IA, labels, spacing, and primitives before tuning individual pages.
2. `Real beats mock`
   If Nerdy has a real feature the reference only implies, keep it and present it better.
3. `One language across pages`
   Cards, headings, controls, badges, and page sections should feel like one app.
4. `Student-facing first`
   Learner settings stay in Settings; technical runtime controls stay in Models or Session.
5. `Future provider ready`
   Reserve clean UI slots for future providers such as Simpy and HeyGen.

## Visual direction

Keep the current light theme base, but make it more resolved:

- stronger section hierarchy
- cleaner navigation grouping
- more deliberate card composition
- less inline styling, more reusable classes
- calmer tutor-first session identity
- more polished empty states and helper text

The goal is not to copy the reference line-for-line. The goal is:

- Radiant-level page quality
- Nerdy-specific capability
- cleaner product honesty

## Information architecture

### Shared shell

- sidebar labels must match actual routes and product language
- use grouped sections similar to the screenshot structure
- remove dead submenu routes unless implemented
- search should either become real shared behavior or be clearly local/page-scoped
- account menu actions must be real, not decorative

### Dashboard

- learner-specific welcome
- four clear metrics
- compact continue-learning cards
- clear tutor-session launch module

### Lessons

- search + grade browse as primary controls
- no internal session setup block at top
- lesson cards with clearer metadata and visual identity

### Profile

- summary-first profile card
- edit mode only where persistence is real
- structured account data presentation

### Settings

- learner-facing preferences
- account controls
- move technical runtime/session defaults out

### Models

- polished LLM/TTS configuration cards
- present current default selections clearly
- reserve visible space for future provider expansion

### Avatars

- persona-led card design
- stronger selection affordance
- recommendation framing
- keep real 2D/3D runtime support

### Session

- tutor identity first
- compact system metadata second
- stronger empty-state welcome
- keep history, persistence, mic, audio, and runtime depth

## Technical design

### Shared primitives

Create or refactor reusable page primitives for:

- page headers
- section cards
- metric cards
- row cards
- form rows
- pill filters
- selection cards

### Data shape cleanup

Move page-local static arrays toward shared typed view-model helpers where practical.

### Styling cleanup

- replace repeated inline styles with reusable CSS classes
- keep CSS variables as the source of truth
- improve responsive behavior with mobile-first adjustments

### File strategy

Keep files under control by extracting page sections/components instead of growing page files further.

## Test strategy

- add/update page render tests for changed content
- add shell/nav regressions where route labels or layout behavior change
- preserve current session behavior tests
- run frontend tests and typecheck before handoff

## Risks

- dashboard/profile/lessons can drift if shell work is skipped
- session polish can accidentally degrade real behavior if visual edits are mixed with transport logic
- working tree is already dirty, so edits must stay narrowly scoped and non-destructive

## Execution order

1. shared shell
2. shared page primitives
3. dashboard
4. lessons
5. profile
6. settings
7. models
8. avatars
9. session polish
10. verification
