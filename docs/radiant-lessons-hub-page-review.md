# Radiant Lessons Hub Page Review

## Scope

This document rates the current Nerdy frontend against:

- the provided page screenshots
- the reference repo `maxpetrusenko/radiant-lessons-hub`
- the current local implementation in `frontend/app/*`, `frontend/components/layout/*`, and `frontend/components/TutorSession.tsx`

This is the closest practical answer to "how Claude would rate our code" for these pages: design fidelity, product clarity, code maturity, and implementation completeness weighted together.

## Scoring rubric

- `90-100`: excellent parity or clearly better than the reference with strong code quality
- `75-89`: solid page with a few noticeable product or implementation gaps
- `60-74`: usable, but obvious mismatch versus the target or weak implementation details
- `40-59`: works, but the page is materially off target in UX, visual hierarchy, or code structure
- `0-39`: broken or mostly placeholder

## Rerate: 2026-03-11 after the UI upgrade pass

This rerate reflects the current local code in `frontend/app/*`, `frontend/components/layout/*`, `frontend/components/ui/*`, and `frontend/components/TutorSession.tsx`.

The earlier detailed notes below still explain the original gaps well, but the scores have moved. The app is materially closer to `radiant-lessons-hub` now.

### Updated shared shell score: 82/100

What changed:

- grouped sidebar taxonomy now matches the target structure much more closely
- header search now routes into lessons search
- header sign-out is wired through `DashboardLayout`
- shared page/card primitives make the pages feel related instead of ad hoc

What still holds it back:

- brand/look still reads as Nerdy, not yet as polished as the reference
- notifications control is still decorative
- some header and menu styling still relies on inline styles instead of one finished shell system

### Updated page ratings

| Screenshot | Page | Old Score | New Score |
| --- | --- | --- | --- |
| #1 | Tutor Session | 76 | 86 |
| #2 | Settings | 57 | 88 |
| #3 | Profile | 49 | 87 |
| #4 | Models | 68 | 87 |
| #5 | Avatars | 72 | 84 |
| #6 | Lessons | 52 | 85 |
| #7 | Dashboard | 46 | 88 |

### Current read

The app is no longer "close in a few places." It is now broadly aligned with the reference layout and page IA, while still keeping the more real Nerdy-specific features on session, models, and avatars.

What improved most:

- Dashboard now has the correct welcome, metrics, continue-learning, and quick-start composition
- Dashboard continue-learning now pulls from persisted lesson progress and archived resume data
- Lessons now matches the search plus grade-pill browse pattern instead of the old setup-heavy page
- Settings now behaves like a learner settings page instead of a runtime control panel
- Profile now matches the summary-first structure and uses real learner preferences instead of fake birthday-style placeholders
- Models now explains why each brain and voice choice exists instead of only exposing raw provider dropdowns
- Profile now has a saved-lesson library instead of ending at static account metadata
- Settings now includes a current learner setup summary instead of only controls
- Models now uses curated provider choice cards, which is much closer to a product decision surface than a settings form

What still blocks 90+ across the board:

- several pages still use mocked or placeholder learner data
- some visual details are still utilitarian rather than fully product-polished
- session still leans slightly toward operator console language in places
- models still reads as technical configuration more than a curated AI tutor chooser
- profile still exposes missing persistence through placeholder values like birthday and grade

### Learning data status

This repo now has real lesson-level learning data for session resume flows.

What exists now:

- persisted `lessonState` in the lesson thread store
- lesson title, program steps, current task, and next question
- restore across local storage, Firebase lesson store, and backend lesson API persistence
- tutor-led resume UX that points the learner to the next question instead of a blank start
- dashboard continue-learning and quick-start cards sourced from active lesson and archived lesson threads
- profile learner snapshot sourced from saved preferences and active lesson progress

What does not exist yet:

- aggregate progress analytics
- real streaks, time-spent, and achievement metrics derived from learner history
- mastery scoring or step auto-advance

### Page-by-page rerate thoughts

#### Tutor Session: 86/100

- Much better than before. Tutor identity now leads the page, the welcome state exists, and the session shell feels intentional.
- Still short of 90 because the header/status area is more operational than the calm tutor-first reference. `New` and `History` are useful, but the metadata treatment still feels product-console.

#### Settings: 88/100

- Strong recovery. The page now maps well to the target: notifications, sound, language, account section.
- The new learning-defaults section makes the page feel more like a real student settings surface.
- The current-setup summary gives the page a clearer sense of state.
- Still short of 90 because account actions are lighter than the reference and the page could use one more layer of delight or motion.

#### Profile: 87/100

- Big improvement. Summary-first structure is correct, and the page now reads from actual learner preferences and lesson state.
- The saved-lesson library makes the page feel like a real learner home rather than an account placeholder.
- Still short of 90 because it is honest but not yet deeply personalized. It needs richer long-term learning history and wins, not just current preference and resume state.

#### Models: 87/100

- Better framing, better title, and the Simpy/HeyGen roadmap slots are the right forward-looking move.
- Curated provider choice cards make the surface feel much more product-led and less like backend controls.
- Still short of 90 because model detail still falls back to selects for the exact model pick and the roadmap area could feel more premium.

#### Avatars: 84/100

- Strong page. Good card browse flow, better selection state, and real Nerdy-specific 2D/3D value.
- Still short of 90 because the personalities are less instantly legible and child-friendly than the reference cast.

#### Lessons: 85/100

- One of the biggest jumps. Search, grade filters, lesson-card browse, and direct session entry are now close to the target.
- Still short of 90 because the catalog is still static and some card iconography is more placeholder than polished.

#### Dashboard: 88/100

- Massive improvement. The page now follows the target's structure closely and feels like the right home screen.
- Continue-learning is now grounded in real persisted lesson progress, which makes the page materially more honest.
- Metric labels are now more truthful, but the page is still short of 90 because it lacks richer long-term analytics and a bit more visual personality.

## Overall read

Nerdy is strongest where the product is real, especially the session flow and avatar runtime. It is weakest where the UI still carries prototype structure, hardcoded data, inline styles, and partial page rewrites. The current app is not a bad frontend, but it is not yet a coherent port of `radiant-lessons-hub`.

The biggest cross-page misses:

- shell taxonomy does not match the screenshots or the reference repo
- too many pages still depend on hardcoded/mock content
- heavy inline styling makes consistency harder to maintain
- several pages are functionally real but visually less resolved than the target
- some controls are present but do not feel product-complete

## Shared shell score: 58/100

### What works

- clean light theme tokens in `frontend/app/globals.css:1460`
- reusable layout shell exists through `DashboardLayout`
- sidebar, header, and page cards are consistent enough to ship

### What is missing

- navigation labels do not match the screenshots: local uses `Home` and `Avatar`; target uses `Dashboard` and `Avatars` in grouped sections
- sidebar children for `/lessons/math`, `/lessons/science`, `/lessons/english` do not appear to exist, so the IA advertises dead routes from `frontend/components/layout/Sidebar.tsx:37-41`
- header search is visual-only, not connected to page state from `frontend/components/layout/Header.tsx:63-75`
- header account menu is partly decorative; the `Sign out` button has no action from `frontend/components/layout/Header.tsx:137-149`
- shell styling is generic and flatter than the target. The reference sidebar/header composition has clearer sectioning and stronger information scent

### Improvement priority

1. Make sidebar taxonomy match the shipped routes and screenshots exactly.
2. Remove dead submenu links or implement them.
3. Turn header search into shared routed search or remove it until real.
4. Move header menu actions to real callbacks.
5. Extract shell primitives instead of mixing CSS classes and inline styles.

## Page ratings

| Screenshot | Page | Score |
| --- | --- | --- |
| #1 | Tutor Session | 76 |
| #2 | Settings | 57 |
| #3 | Profile | 49 |
| #4 | Models | 68 |
| #5 | Avatars | 72 |
| #6 | Lessons | 52 |
| #7 | Dashboard | 46 |

## 1. Tutor Session: 76/100

### Why this scores best

- this page has real product depth, not just mock UI
- avatar rendering, playback state, persistence, runtime selection, and history are materially more advanced than the reference
- the page already follows the approved redesign direction in `docs/plans/2026-03-10-image-guided-ui-layout-design.md`

### What Claude would likely praise

- real state model and transport abstraction in `frontend/components/TutorSession.tsx`
- history drawer instead of permanent clutter
- actual keyboard shortcuts, mic flow, and conversation persistence
- the session surface is not fake; it is a real product surface

### What is still missing versus the screenshot

- header identity does not match the mock. The screenshot centers on the tutor persona; local page still leads with generic `Tutor Session` from `frontend/components/TutorSession.tsx:1077`
- top-right status uses connection state plus `New` and `History`, but the target shows compact model plus latency context
- the avatar section is stronger technically, but the visual hierarchy is more product-console than calm tutor stage
- the friendly first tutor bubble in the screenshot is not part of the same composition; local page leans on live transcript state instead
- the design is close in layout intent, but not yet close in emotional tone

### Code thoughts

- the component is doing a lot. The logic is justified, but the file is very large and mixes transport, persistence, keyboard handlers, mic lifecycle, render markup, and view-state orchestration
- this is the one place where the product outgrew the page shell and deserves more component extraction

### Improve next

1. Split `TutorSession.tsx` into transport, history, composer, and session-header subcomponents.
2. Reframe the header around tutor identity first, system metadata second.
3. Add a compact latency/model strip closer to the target.
4. Introduce an explicit welcome state when the thread is empty.
5. Keep the real features, but restyle them to feel calmer and more teacher-led.

## 2. Settings: 57/100

### What works

- real persistence through `session_preferences`
- account section uses live auth context
- card grouping roughly matches the reference

### What is missing

- the target page has clear product preferences like notifications, sound effects, and language; local page instead exposes technical session defaults from `frontend/app/settings/page.tsx:38-77`
- this makes the page feel more like an internal control panel than a student settings page
- the visual system is thinner than the mock: raw text input plus range slider instead of high-confidence toggles/selects
- account section is underpowered compared with the screenshot. Only sign-out is real

### Code thoughts

- functionally honest, but conceptually off target
- strong product mismatch: "settings" in the reference means user experience preferences; local "settings" means session internals

### Improve next

1. Move session runtime defaults to Models or Session setup.
2. Rebuild Settings around learner-facing preferences first.
3. Add reusable switch and select components.
4. Add password and destructive account actions only if they are actually wired.

## 3. Profile: 49/100

### What works

- live auth identity is used
- form fields are straightforward
- the page is usable as a basic account form

### What is missing

- the screenshot and reference repo use a cleaner summary-first profile card. Local page jumps straight into editable fields
- the grade and birthday do not derive from persisted profile data. Birthday has no current value and grade is not computed from it
- local `select` is unstyled relative to the rest of the page from `frontend/app/profile/page.tsx:78-86`
- the page has no save behavior. `onSubmit` prevents default and stops there from `frontend/app/profile/page.tsx:49`
- visually, the top section lacks the informative detail rows that made the reference feel finished

### Code thoughts

- most incomplete page in terms of product honesty
- it looks editable, but it is not actually a profile management feature yet

### Improve next

1. Decide: summary-first profile or editable profile. Do not mix unfinished versions.
2. Wire profile persistence before keeping editable controls.
3. Add structured read-only rows for name, email, birthday, and grade.
4. Style `select` consistently with the input system.

## 4. Models: 68/100

### What works

- real runtime plumbing is better than the reference mock
- normalization and provider switching are handled cleanly in `frontend/app/models/page.tsx:18-31`
- this page has legitimate operational value

### What is missing

- the screenshot shows a more curated model-selection UX with descriptive cards and lightweight helper text
- local page is more technical and more verbose: provider and model split for both LLM and TTS creates a denser control form than the target
- the page title `Model Settings` is weaker than the screenshot's `AI Models`
- iconography and visual emphasis from the reference are missing

### Code thoughts

- good functional foundation
- medium design debt, low product debt
- this page feels closest to "real app, unfinished polish"

### Improve next

1. Collapse provider plus model into clearer grouped selectors.
2. Add visual metadata cards for current selections.
3. Use product language instead of backend language where possible.
4. Bring back icon-led sections to match the reference hierarchy.

## 5. Avatars: 72/100

### What works

- real avatar system beats the reference mock in capability
- 2D and 3D modes are useful, real, and specific to Nerdy
- gallery pattern is close to the screenshot's browse-and-pick behavior

### What is missing

- the screenshot sells personality through compact, child-friendly avatar cards. Local page feels more like a provider picker
- descriptions are weaker in presentation and less legible than the reference
- selected state is serviceable but less expressive than the screenshot's clear check badge
- the top-level naming differs from the shell and screenshot: local code uses singular `Avatar` in nav but plural expectation elsewhere

### Code thoughts

- good example of product value outrunning presentation quality
- the page is useful, but the framing is more technical than playful

### Improve next

1. Rewrite cards around persona, teaching style, and age fit.
2. Improve selected-state affordance with a persistent badge/check treatment.
3. Align nav naming to `Avatars`.
4. Consider grade-based recommendations or "best for you" ordering.

## 6. Lessons: 52/100

### What works

- clear route into session
- filtering works
- lesson cards are readable

### What is missing

- the page is materially off-target from the screenshot and reference repo
- the target page is grade-centric with search and compact lesson cards; local page adds a large `Session setup` section at the top from `frontend/app/lessons/page.tsx:123-160`
- the filter model is subject plus difficulty, not search plus grade band like the target
- the page lacks icons and card personality, so it reads flatter than the screenshot
- lesson catalog is still hardcoded in-page from `frontend/app/lessons/page.tsx:11-84`

### Code thoughts

- structurally fine
- product framing is wrong for the target
- this page feels like an internal prototype that still owns too many concerns

### Improve next

1. Remove `Session setup` from the top of Lessons.
2. Restore search plus grade pills as the primary browse controls.
3. Move default subject and grade preferences elsewhere.
4. Add richer lesson metadata and visual identifiers.
5. Source lessons from shared data instead of page-local constants.

## 7. Dashboard: 46/100

### What works

- clean card rhythm
- obvious CTA to start learning
- layout is readable and responsive enough

### What is missing

- this is the page furthest from the screenshot and reference dashboard
- local dashboard uses generic hero marketing copy instead of the student's name, streak framing, and quick-start context from `frontend/app/dashboard/page.tsx:38-63`
- only three stats exist locally; target shows four and gives each stronger visual identity from `frontend/app/dashboard/page.tsx:15-20`
- continue-learning cards are more generic and use inline progress bars that do not match the target composition
- the reference quick-start module is a clean single card; local page spreads value across hero plus separate sections
- all data is still mocked in-page from `frontend/app/dashboard/page.tsx:15-32`

### Code thoughts

- this page needs the biggest redesign pass
- the current implementation is not wrong, but it belongs to a different product direction than the screenshots

### Improve next

1. Replace the hero with a learner-specific welcome block.
2. Add the fourth stat and icon-led metric cards.
3. Rebuild continue-learning as compact horizontal cards.
4. Add a single prominent tutor-session launch card.
5. Move dashboard data to a shared data source and stop hardcoding page-local arrays.

## What is missing overall

If the goal is true parity with `radiant-lessons-hub`, the missing pieces are not only polish. They are mostly product-structure issues:

- one shared page design system for forms, cards, list rows, badges, and buttons
- real data sources for dashboard and lessons
- consistent route taxonomy between nav, screenshots, and shipped pages
- removal of dead or decorative-only UI
- better separation between student-facing settings and system-facing runtime controls
- more component extraction from oversized pages, especially session

## Final verdict

Nerdy today is better than the reference in live session capability, audio/avatar sophistication, and real runtime behavior. It is worse than the reference in page coherence, visual parity, information architecture, and consistency.

If I compress the entire review into one line:

- strong real tutor core
- mid shell
- weak dashboard and profile parity
- settings and lessons still structurally off target
