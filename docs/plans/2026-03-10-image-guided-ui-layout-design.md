## Goal

Refit the tutor UI to follow the user-provided mock more closely.

## Approved Direction

Use the recommended approach:

- left rail for lesson settings and secondary controls
- one-line top header
- oversized centered avatar stage
- composer directly under the avatar
- latency as a compact single-line strip
- history hidden by default behind a toggle

## Why This Direction

- closest to the mock
- least structural churn versus the current code
- keeps current voice, subtitle, and lesson-session behavior intact

## Implementation Notes

- remove the current hero-card-first hierarchy
- make the main shell a left-rail plus center-stage layout
- move the text composer into the center column under the avatar
- keep mic hold-to-talk
- keep stop and volume in the avatar header
- keep history collapsible
