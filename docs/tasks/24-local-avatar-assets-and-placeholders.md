# Task 24: Local Avatar Assets and Placeholders

## Goal

Stand up a cheap local avatar catalog so model experimentation does not require paid providers.

## Owner

Frontend / 3D pipeline engineer

## Depends On

- Task 23

## Planned Files

- `frontend/public/avatars/`
- `frontend/public/avatars/README.md`
- `frontend/lib/avatar_asset_loader.ts`
- `frontend/components/Avatar3D.tsx`
- `frontend/components/AvatarRenderer.tsx`
- `frontend/lib/avatar_asset_loader.test.ts`

## Deliverables

- local placeholder avatar pack
- asset loader with fallback behavior
- documented source/license note per asset
- runtime-safe low-poly baseline assets

## Done Criteria

- at least four local presets exist for testing
- missing/bad assets fall back cleanly
- no paid API is required to test avatar switching
- every shipped test asset has a documented license/source

## Notes

- prefer CC0 or clearly permitted free assets
- avoid exact branded/IP characters in repo/demo until rights are explicit

## Parallel

After Task 23 manifest shape is frozen.
