# Task 23: Avatar Catalog and Selector

## Goal

Replace the current provider toggle with a manifest-backed selector that makes `2D` vs `3D` and specific avatar choices easy to switch.

## Owner

Frontend / product engineer

## Depends On

- Task 08
- Task 09

## Planned Files

- `frontend/components/TutorSession.tsx`
- `frontend/components/AvatarProvider.tsx`
- `frontend/components/avatar_registry.ts`
- `frontend/components/AvatarSelector.tsx`
- `frontend/lib/avatar_manifest.ts`
- `frontend/components/AvatarSelector.test.tsx`
- `frontend/components/TutorSession.test.tsx`

## Deliverables

- `Render Mode` dropdown
- `Avatar` dropdown
- manifest-backed avatar options
- easy switch between multiple 2D and 3D presets

## Done Criteria

- a reviewer can switch from `2D` to `3D` and between multiple avatars with no code edits
- `2D` remains the default baseline
- 3D assets still lazy-load
- the selector contract is data-driven, not hard-coded per avatar

## Parallel

Start before live asset work. Freeze manifest schema first.
