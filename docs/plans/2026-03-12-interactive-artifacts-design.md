# Interactive Artifacts Design

## Goal

Add a Claude-style artifact surface to `/session` so the tutor can show manipulable teaching aids instead of only text and voice.

Initial target:

- fractions with pizza slices
- drag, combine, cut, label
- tutor can spawn/update the artifact from lesson context
- state can sync with Yjs for multi-client continuity later

## Why this fits Nerdy

Current `/session` already has two clear panels:

- avatar stage in [`frontend/components/session/TutorSessionAvatarStage.tsx`](../../frontend/components/session/TutorSessionAvatarStage.tsx)
- prompt / lesson card area in [`frontend/components/session/TutorSessionComposer.tsx`](../../frontend/components/session/TutorSessionComposer.tsx)

That means artifacts can land as a third session panel without rewriting transport, lesson persistence, or avatar code.

## Product read

Claude artifacts work because they are:

- separate from chat
- substantial and reusable
- interactive when needed

Anthropic describes artifacts as standalone content shown in a dedicated side window, including SVG, code, websites, and interactive React components:

- https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them

For Nerdy, the right translation is not "generic code playground". It is "lesson artifact stage":

- teacher visual
- student manipulates it
- tutor reacts to artifact state

Product clarification:

- `Tutor Session` stays open-ended
- `Lessons` is the concept-learning flow
- artifacts auto-open in Lessons when the concept needs them
- artifacts do not auto-open in Tutor Session

## Research findings

### 1. Yjs is a good fit for artifact state

Yjs is built for syncable shared state, not only text editors. Official docs highlight shared `Array` and `Map` types, websocket sync, awareness, and IndexedDB persistence.

Useful references:

- shared types: https://docs.yjs.dev/getting-started/working-with-shared-types
- websocket provider: https://docs.yjs.dev/ecosystem/connection-provider/y-websocket
- awareness: https://docs.yjs.dev/getting-started/adding-awareness
- offline persistence: https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb

Implication:

- artifact piece positions can live in `Y.Map` / `Y.Array`
- cursor / active piece state can live in awareness, not persisted doc state
- local-first resume is easy with `y-indexeddb`

### 2. tldraw is powerful, but not the default pick here

tldraw offers custom shapes and sync out of the box:

- shapes/custom shapes: https://tldraw.dev/docs/shapes
- sync: https://tldraw.dev/docs/sync

But current licensing changed. Official docs say the SDK requires a license key for production use:

- license: https://tldraw.dev/community/license
- license key: https://tldraw.dev/sdk-features/license-key

Implication:

- great for a spike
- not ideal as the default foundation for Nerdy MVP unless we want new license/commercial overhead

### 3. `react-konva` is the pragmatic canvas option

Konva's official React docs show draggable canvas nodes with a normal React mental model:

- https://konvajs.org/docs/react/

The package is MIT-licensed:

- https://github.com/konvajs/react-konva

Implication:

- enough for draggable pizza slices, bars, tiles, number lines
- lower product/license risk than tldraw
- we own the artifact UX instead of inheriting a whiteboard product

### 4. Raster slicing is possible, but should not be v1

Sharp supports deterministic extraction/cropping:

- https://sharp.pixelplumbing.com/api-resize

So yes, we could download a pizza image, slice regions, and emit assets. But repo policy already prefers repo-original / clearly licensed assets:

- [`docs/avatar-costs-and-licensing.md`](../../docs/avatar-costs-and-licensing.md)

Implication:

- avoid random downloaded pizza JPGs in v1
- start with repo-original SVG pizza wedges
- add raster slicing only if a later lesson truly needs photo realism

## Recommended direction

Build a narrow artifact system, not a general whiteboard.

### v1 stack

- `Yjs` for artifact document state
- `y-websocket` or a tiny server-compatible equivalent for sync rooms
- `y-indexeddb` for local persistence
- `react-konva` for interaction canvas
- repo-original SVG or canvas-drawn lesson pieces

### v1 artifact types

- `fraction-pizza`
- `fraction-bar`
- `number-line`
- `equation-balance` later

### v1 interaction tools

- `circle` tool: create a whole pizza / fraction circle
- `knife` tool: cut the circle into equal fractional wedges

Rule:

- cap pizza cuts at `1/16`

### Why this beats a generic whiteboard first

- smaller scope
- better tutor control
- cleaner pedagogical primitives
- no production license dependency
- easier testability

## Proposed UX

Inside `/session`, add `LessonArtifactPanel` between avatar stage and composer.

Panel states:

- Tutor Session empty: no artifact by default
- Lessons open: auto-open seeded artifact when lesson metadata requires it
- live: manipulable lesson artifact
- replay: persisted artifact state for resumed lessons

Core controls:

- drag pieces
- tap/click to select
- `circle` tool
- `knife` tool
- snap pieces into plate zones
- combine valid pieces by moving them together
- after a cut, separate pieces slightly so they can be grabbed
- reset
- shade / unshade
- optional "Tutor demo" button to animate the next step

## Proposed architecture

### Frontend

Create:

- `frontend/components/session/LessonArtifactPanel.tsx`
- `frontend/components/session/artifacts/FractionPizzaArtifact.tsx`
- `frontend/components/session/artifacts/artifact_types.ts`
- `frontend/lib/artifacts/artifact_doc.ts`
- `frontend/lib/artifacts/artifact_yjs.ts`

Responsibilities:

- render artifact from normalized state
- translate pointer actions into artifact ops
- observe Yjs doc and React state
- keep awareness separate from persisted lesson state

### Backend

Do not mix artifact sync into the existing tutoring websocket first.

Current `/ws/session` is latency-sensitive and centered on audio / turn events in [`backend/session/server.py`](../../backend/session/server.py).

Better options:

1. separate Yjs websocket endpoint for artifact docs
2. managed Yjs provider/service
3. local-only Yjs in phase 1, network sync in phase 2

Recommended:

- phase 1: local Yjs doc + IndexedDB only
- phase 2: dedicated artifact websocket room keyed by lesson session id

## Data model sketch

Use one artifact doc per lesson session.

Top-level map:

```ts
type ArtifactDocument = {
  artifactId: string
  type: "fraction-pizza"
  version: 1
  mode: "tutor-session" | "lesson"
  lessonId?: number
  promptRef?: string
  maxDenominator: 16
  activeTool?: "circle" | "knife" | "select"
  pieces: Array<{
    id: string
    kind: "slice"
    denominator: number
    numeratorValue: number
    x: number
    y: number
    rotation: number
    selected: boolean
    filled: boolean
    groupId?: string
  }>
  zones: Array<{
    id: string
    kind: "plate" | "answer-slot"
    x: number
    y: number
    acceptsDenominator?: number
  }>
  annotations: Array<{
    id: string
    text: string
    x: number
    y: number
  }>
}
```

Yjs mapping:

- root: `Y.Map`
- `pieces`: `Y.Array<Y.Map>`
- `zones`: static or `Y.Array<Y.Map>`
- `annotations`: `Y.Array<Y.Map>`
- awareness: active pointer, selected piece, user color

Important Yjs caveat:

- do not mutate plain JSON objects after insertion; write back through Yjs transactions

## Tutor integration

Do not ask the model to emit arbitrary React or canvas code first.

Instead expose a narrow tool contract:

```json
{
  "type": "show_artifact",
  "artifact": "fraction-pizza",
  "state": {
    "denominator": 4,
    "highlightedSlices": 1,
    "goal": "show 1/4 + 2/4"
  }
}
```

Later tool actions:

- `create_artifact`
- `set_artifact_state`
- `set_artifact_tool`
- `cut_artifact`
- `highlight_piece`
- `animate_step`
- `reset_artifact`

This keeps the tutor deterministic and testable.

## Asset strategy

### Recommended v1

- generate pizzas as SVG wedges from math
- color/fill states from local props
- no downloaded raster assets required
- deterministic equal-slice cut rules only

### Optional v2

If we really want photo-like pizza pieces:

- source only from approved license-safe assets
- record attribution in repo docs
- preprocess with Sharp in a build script
- keep generated output deterministic

## Rollout plan

### Phase 0: design + schema

- freeze artifact event contract
- freeze fraction pizza state schema
- decide panel placement in `/session`

### Phase 1: single-user local artifact

- render `LessonArtifactPanel`
- repo-original SVG pizza wedges
- `circle` + `knife` tools
- drag/drop + snapping + combine
- persist artifact snapshot in lesson thread store

Success bar:

- a learner can solve `1/4 + 2/4` interactively in one browser tab
- a whole pizza can be cut only to `1/16` max

### Phase 2: Yjs local-first

- wrap artifact state in Yjs doc
- add IndexedDB persistence
- restore artifact on session resume

Success bar:

- refresh page, artifact state survives

### Phase 3: multi-client sync

- dedicated artifact websocket room
- awareness cursors / active manipulator state
- shared tutor + learner view

Success bar:

- two tabs stay in sync within one lesson session

### Phase 4: tutor-driven artifact actions

- LLM tool calls produce artifact actions
- Lessons can auto-open a seeded pizza on start
- artifact opens with exact teaching state

Success bar:

- artifact generation is deliberate, not hardcoded prompt glue

## Risks

- mixing artifact events into the current audio websocket could hurt latency and clarity
- generic whiteboard scope creep
- downloaded lesson images create licensing/documentation overhead
- letting the LLM generate arbitrary artifact code would be brittle and unsafe

## Decision

Recommended build order:

1. custom `fraction-pizza` artifact
2. `circle` + `knife` tool rules with `1/16` cap
3. lesson auto-open seed path
4. local persisted state
5. Yjs doc wrapper
6. multi-tab sync
7. tutor tool integration

Not recommended for first ship:

- full tldraw embed
- arbitrary artifact code execution
- downloaded raster pizza assets as the core content path
