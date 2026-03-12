# LiveKit Managed Avatars

Managed avatars now run on a separate LiveKit media plane while local 2D and 3D avatars stay on the existing browser renderer path.

## Providers

- `simli-b97a7777-live` -> Simli face streamed into a LiveKit room
- `heygen-liveavatar-default` -> LiveAvatar streamed into a LiveKit room

## Required env

```bash
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
OPENAI_API_KEY=
SIMLI_API_KEY=
SIMLI_FACE_ID=
LIVEAVATAR_API_KEY=
LIVEAVATAR_AVATAR_ID=
```

Accepted aliases for HeyGen:

- `HEYGEN_API_KEY`
- `HEYGEN_AVATAR_ID`

## Run locally

Install Python deps, then run the worker in a second terminal:

```bash
python3 -m pip install -e '.[dev]'
python3 -m backend.livekit.avatar_agent start
```

Run the app as usual:

```bash
bash scripts/dev.sh
```

## UI behavior

- Select a managed avatar in `/avatar`
- Open `/session`
- The avatar panel switches to a LiveKit room surface
- Click `Start Live Session`
- Grant microphone access
- Speak directly to the avatar through the room
