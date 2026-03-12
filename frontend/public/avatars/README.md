# Local Avatar Presets

Offline smoke assets live here by convention.

This lane uses repo-local procedural avatars first:

- `sage`
- `albert`
- `nova`
- `dex`
- `banana`
- `apple`
- `human`
- `robot`
- `wizard-school-inspired`
- `yellow-sidekick-inspired`

The current runtime does not ship third-party `.glb` binaries. `Avatar3D` builds the 3D presets from local Three.js primitives, `AvatarRenderer` builds the CSS 2D variants from preset palettes, and the `svg-2d` provider renders the tutor characters from repo-local SVG components.

`model_url` values still point at `/avatars/*.glb` so the manifest shape is stable for future binary assets. Until real models land, the asset loader validates those refs and falls back to the safe local human preset when a preset is missing or invalid.
