# AI Math Tutor

Open source realtime voice tutor stack for building low-latency, Socratic learning agents.

Repository codename and Python package remain `nerdy` for now. GitHub-facing name: `AI Math Tutor`.

## Why It Gets Attention

- realtime voice loop: mic -> STT -> LLM -> TTS -> avatar
- pluggable providers across STT, LLM, TTS, avatar
- default `2D CSS` tutor, optional lazy-loaded `3D Three.js` tutor
- benchmark, eval, unit, integration, and browser smoke coverage already in repo
- built for fast provider swaps, not one locked demo stack

## What Is Real Today

- backend session server in `FastAPI` with streamed WebSocket turns
- STT provider path with `Deepgram` live default
- LLM provider path with `MiniMax` primary and `Gemini` fallback
- TTS provider path with `Cartesia` primary and `MiniMax` alternate
- browser mic path sending `audio.chunk.bytes_b64`
- transcript, latency cards, interruption, avatar switching, and playback UI

## Architecture

```text
Browser mic / text
  -> FastAPI WebSocket session
  -> STT provider session
  -> LLM provider switch
  -> TTS provider context
  -> browser audio player
  -> 2D CSS or 3D Three.js avatar
```

Provider selection is environment-driven. Session contracts stay stable while providers change behind the registry.

## Tools

| Layer | Current choice | Notes |
| --- | --- | --- |
| Frontend | `Next.js 15` + `React 19` + `TypeScript` | app shell, avatar UI, latency UI |
| Backend | `FastAPI` + `uvicorn` | session authority |
| STT | `Deepgram` | default provider |
| LLM | `MiniMax` + `Gemini` fallback | registry-backed switch |
| TTS | `Cartesia` or `MiniMax` | streamed speech path |
| 3D Avatar | `three`, `@react-three/fiber`, `@react-three/drei` | optional, lazy-loaded |
| Tests | `pytest`, `vitest`, `playwright` | backend, frontend, e2e |

## Install

### Prereqs

- `python` `3.11+`
- `pnpm`

### Quickstart

```bash
python3 -m pip install -e '.[dev]'
cd frontend
pnpm install
cd ..
cp .env.example .env
cp frontend/.env.example frontend/.env.local
bash scripts/dev.sh
```

Open `http://127.0.0.1:3000`.

### Manual Split

Backend:

```bash
python3 -m pip install -e '.[dev]'
uvicorn backend.session.server:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
pnpm install
pnpm dev --hostname 127.0.0.1 --port 3000
```

## Env

Core backend switches:

```bash
NERDY_STT_PROVIDER=deepgram
NERDY_LLM_PROVIDER=minimax
NERDY_LLM_FALLBACK_PROVIDER=gemini
NERDY_TTS_PROVIDER=cartesia
NERDY_AVATAR_PROVIDER=threejs
DEEPGRAM_API_KEY=
```

Frontend:

```bash
NEXT_PUBLIC_SESSION_WS_URL=ws://127.0.0.1:8000/ws/session
```

If you only want the typed demo path, frontend still runs without live mic credentials.

## Provider Swaps

This part is intentionally easy now.

1. add a wrapper in `backend/providers/<kind>/`
2. register it in the provider registry/config path
3. switch env vars without touching session semantics

That keeps the app usable while you change STT, LLM, TTS, or avatar providers.

## Repo Map

```text
backend/
  llm/                prompt policy and provider switch
  providers/          registry-backed STT, LLM, TTS, avatar wrappers
  session/            FastAPI WebSocket session server
  monitoring/         latency tracking
  benchmarks/         canned prompts and latency runner
frontend/
  app/                Next.js app shell
  components/         tutor UI, avatars, mic, playback, latency cards
  lib/                socket, metrics, avatar timing/runtime drivers
  e2e/                Playwright smoke flows
eval/                 Socratic checks and fixtures
docs/                 architecture, stack, demo, trace, checklist
tests/                backend and docs verification
```

## Runbook

What you should see:

- connected session pill once backend is up
- prompt box plus live mic capture
- `Run Demo Turn` and `Interrupt`
- latency cards
- transcript and tutor reply panels
- avatar mode switch between `2D CSS` and `3D Three.js`

## Verification

Backend:

```bash
python3 -m pytest -q
```

Frontend:

```bash
cd frontend
pnpm verify
pnpm e2e
```

`pnpm verify` runs:

```bash
pnpm test
pnpm build
pnpm typecheck
```

## Current State

- backend test suite passing
- docs freshness checks passing
- frontend unit, build, typecheck flow in place
- browser smoke coverage started for app load, demo turn, interrupt, avatar mode

See:

- `docs/ARCHITECTURE.md`
- `docs/STACK.md`
- `docs/requirements-trace.md`
- `docs/progress.md`

## Roadmap

- reviewer-facing latency closure for `first_viseme` and `audio_done`
- deeper browser mic smoke coverage
- richer session context and personalization
- stronger benchmark evidence from live providers
- more providers, same contracts

## Contributing

High-signal areas:

- new provider adapters
- latency instrumentation
- avatar quality and sync
- pedagogy and eval depth
- browser smoke reliability

If you add behavior or change an interface, update docs in the same change.
