# Local Avatar Presets

Offline smoke assets live here by convention.

This lane uses repo-local procedural avatars first:

- `banana`
- `apple`
- `human`
- `robot`
- `wizard-school-inspired`
- `yellow-sidekick-inspired`

The current runtime does not ship third-party `.glb` binaries. `Avatar3D` builds these presets from local Three.js primitives, and `AvatarRenderer` builds the 2D variants from CSS shapes plus preset palettes.

`model_url` values still point at `/avatars/*.glb` so the manifest shape is stable for future binary assets. Until real models land, the asset loader validates those refs and falls back to the safe local human preset when a preset is missing or invalid.
