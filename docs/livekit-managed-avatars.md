# LiveKit Managed Avatars

Managed avatars run on a separate LiveKit media plane while the self-hosted TalkingHead tutor stays on the browser renderer path.

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

## Hosted worker

Hosted managed avatars require a separate long-running worker container. The
session API only creates the LiveKit room and dispatches `nerdy-avatar-agent`; it
does not publish avatar media itself.

Build and deploy `ghcr.io/maxpetrusenko/ai-math-tutor-avatar-worker` from
`backend/Dockerfile.worker`. Health checks should stay disabled because this
process is a LiveKit agent worker, not an HTTP server.

Run the app as usual:

```bash
bash scripts/dev.sh
```

## Voice and lipsync contract

Managed avatars are fail-closed:

- the session API returns an expected avatar participant identity, currently `avatar-simli` or `avatar-liveavatar`
- the avatar worker passes that identity into the provider session
- the worker waits for that participant to publish both audio and video before publishing `nerdy.avatar_agent.ready`
- raw model-to-room audio is disabled with `RoomOutputOptions(audio_enabled=False)` while a managed avatar is active
- the browser attaches only audio and video from the expected avatar participant

If a provider fails to attach, the user should see a retryable live-link error
and should not hear the model voice disconnected from avatar lipsync.

The July 2026 Simli incident was not rate limiting. The worker received HTTP 400
`Character loading crashed` because the configured face and the plugin's forced
emotion suffix were incompatible with the account's current v2 face. The fix and
acceptance criteria are tracked in GitHub issue #30.

## UI behavior

- Select a managed avatar in `/avatar`
- The avatar picker shows a local looped preview clip and greeting overlay so browsing feels live without consuming provider sessions
- Open `/session`
- The avatar panel switches to a LiveKit room surface
- Click `Start avatar`
- Grant microphone access
- Speak directly to the avatar through the room after the UI reaches `Live`
