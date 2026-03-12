# LiveKit Managed Avatar Design

## Goal

Unify premium avatar sessions on one media plane so Simli and HeyGen LiveAvatar can both run from the avatar picker and publish audio and video into the lesson UI with native lip sync.

## Decision

- Keep local `2D` and `3D` avatars on the existing browser renderer path
- Add a managed-avatar path for `Simli` and `LiveAvatar`
- Use LiveKit as the shared media plane for both premium providers
- Use one explicit-dispatch agent worker that reads room metadata and starts either provider

## Why

- Simli already has a first-party LiveKit Agents plugin
- LiveAvatar has a first-party LiveKit Agents plugin
- A shared room path is simpler than trying to fit two remote video providers into the old websocket tutor loop
- The local avatar path stays intact as the lowest-risk fallback

## Repo changes

- backend bootstrap endpoint mints LiveKit client tokens and dispatches the avatar worker
- backend worker selects `simli` or `liveavatar` from room metadata
- avatar manifest gains a `live` mode with managed entries
- session UI swaps from local renderer to a LiveKit room surface when a managed avatar is selected

## Risks

- Managed avatars use a separate voice loop from the existing websocket tutor path
- LiveKit credentials and provider keys are now required for those avatars
- Browser autoplay and mic permissions still gate first-run UX
