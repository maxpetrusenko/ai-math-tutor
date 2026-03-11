# Avatar Costs and Licensing Guardrails

This note freezes the cheap, demo-safe rules for avatar work in the MVP tree.

## Default Policy

- Local CSS and local Three.js presets are the default for all day-to-day avatar work.
- Fixture transport is the default for browser smoke, UI polish, and demo rehearsal.
- Premium avatar vendors stay out of the main session path unless the task explicitly says bakeoff.

## Shipped Presets

The repo currently ships only repo-original placeholders:

| Preset | Render modes | Source | Demo-safe status |
| --- | --- | --- | --- |
| `banana` | `2d`, `3d` | repo-original | allowed |
| `apple` | `2d`, `3d` | repo-original | allowed |
| `human` | `2d`, `3d` | repo-original | allowed |
| `robot` | `2d`, `3d` | repo-original | allowed |
| `wizard-school-inspired` | `2d`, `3d` | repo-original homage | allowed if kept non-branded |
| `yellow-sidekick-inspired` | `2d`, `3d` | repo-original homage | allowed if kept non-branded |

Attribution for shipped presets lives in `frontend/public/avatars/ATTRIBUTION.md`.

## Approved External Source List

Use these only when the imported asset and its license are pinned in repo notes before demo use:

- Khronos glTF sample assets for runtime correctness testing only
- Poly Haven CC0 assets for neutral environment or accessory pieces
- Kenney CC0 assets for stylized placeholders
- Fab free assets only after the exact license and source URL are copied into repo docs

## Restricted or Banned Sources

- Exact branded characters or trademarked likenesses
- Premium provider exports copied into the repo
- Marketplace downloads without a pinned license note
- Assets with attribution or redistribution terms that are not documented in-repo

## Premium Provider Rules

Simli, HeyGen, and similar vendors are allowed only when all of the following are true:

1. the task is an explicit premium-avatar bakeoff or benchmark lane
2. the local preset path is already working for the same flow
3. the operator has approved spend for that pass
4. outputs are not committed as shipped demo assets unless the license allows it

Outside those cases:

- do not wire premium vendors into the default tutor session
- do not rely on premium vendors for smoke tests
- do not make demo success depend on them

## Spend Guardrails

| Activity | Default stack | Spend rule |
| --- | --- | --- |
| UI polish | fixture + local presets | zero-credit path only |
| avatar runtime checks | local presets | zero-credit path only |
| browser smoke | fixture transport | zero-credit path only |
| live latency proof | one low-cost stack | minimal bounded spend |
| premium avatar experiments | explicit bakeoff only | approval required |

## Reviewer Notes

- The MVP demo is built to run without any premium avatar dependency.
- The “inspired” presets are intentionally original lookalikes, not branded character reproductions.
- If a future asset source enters the repo, update this file, `docs/cost-performance.md`, and `frontend/public/avatars/ATTRIBUTION.md` in the same change.
