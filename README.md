<p align="center">
  <img src="docs/assets/readme-card.png" alt="AI Math Tutor project snapshot" width="100%">
</p>

<h1 align="center">AI Math Tutor</h1>

<p align="center">
  <strong>Open source realtime voice tutoring with pluggable STT, LLM, TTS, and avatar providers.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-0b1730?style=flat-square" alt="Next.js 15">
  <img src="https://img.shields.io/badge/React-19-0b1730?style=flat-square" alt="React 19">
  <img src="https://img.shields.io/badge/FastAPI-session_server-0b1730?style=flat-square" alt="FastAPI">
  <img src="https://img.shields.io/badge/Realtime-benchmark_first-0b1730?style=flat-square" alt="Benchmark first">
  <img src="https://img.shields.io/badge/Providers-STT%20%7C%20LLM%20%7C%20TTS%20%7C%20Avatar-0b1730?style=flat-square" alt="Provider registry">
</p>

Repository codename and Python package remain `nerdy` for now. GitHub-facing name: `AI Math Tutor`.

---

## Snapshot

This repo is aimed at builders who want a working realtime tutoring spine, not a dead-end demo.

| Scope | Result |
| --- | --- |
| Core loop | browser mic/text -> STT -> LLM -> TTS -> avatar |
| Provider model | env-driven STT, LLM, TTS, and avatar selection |
| Backend verification | `76` passing `pytest` tests in current tree |
| Browser path | session UI, interruption, avatar switching, playback, latency cards |
| Benchmark harness | `90` synthetic local runs, `30` per prompt |
| Timing snapshot | `speech_end -> tts_first_audio` p50 `440 ms`, p95 `480 ms` |
| STT snapshot | `speech_end -> stt_final` p95 `120 ms` |

High-signal results:

- provider swaps now happen behind stable registry-backed session contracts
- browser mic sends `audio.chunk.bytes_b64`
- default tutor is `2D CSS`; `3D Three.js` loads on demand
- eval, docs, smoke tests, and benchmark reports all live in the repo

Benchmark numbers and live-vendor evidence are tracked in [`docs/planning/benchmark-report-v1.md`](docs/planning/benchmark-report-v1.md). The live stack is wired end to end and still misses the latency target explicitly.

## Closure Lanes

Current lane state as of 2026-03-10:

- Lane A `avatar selector`: done
- Lane B `local avatar assets`: done
- Lane C `lesson session + text turns`: done
- Lane D `offline smoke matrix`: done
- Lane E `live benchmark closure`: done
- Lane F `pedagogy + demo + acceptance`: done
- Lane G `cost + licensing`: done
- Lane H `UI polish`: done

---

## What Is AI Math Tutor?

AI Math Tutor is a low-latency tutoring stack for voice-first learning sessions. It is built around short spoken turns, Socratic prompting, interruption-safe playback, and provider swaps that do not require rewriting the session server.

Instead of locking the app to one speech model or one avatar vendor, the project keeps the session protocol stable and lets providers change underneath it.

---

## How It Works

```text
Browser mic / text
  -> FastAPI WebSocket session
  -> STT provider session
  -> LLM provider switch
  -> TTS provider context
  -> browser audio player
  -> 2D CSS or 3D Three.js avatar
```

### Current Runtime

| Layer | Current choice | Notes |
| --- | --- | --- |
| Frontend | `Next.js 15` + `React 19` + `TypeScript` | shell, tutor UI, avatar UI, latency UI |
| Backend | `FastAPI` + `uvicorn` | websocket session authority |
| STT | `Deepgram` | default provider |
| LLM | `MiniMax` + `Gemini` fallback | registry-backed switch |
| TTS | `Cartesia` or `MiniMax` | streamed speech path |
| Avatar | `2D CSS` or lazy-loaded `Three.js` | default plus richer branch |
| Tests | `pytest`, `vitest`, `playwright` | backend, frontend, browser smoke |

---

## Getting Started

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
`scripts/dev.sh` auto-loads `.env`, `.env.local`, and `frontend/.env.local` into the spawned processes.

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

### Environment

Backend:

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

If you only want the typed demo path, the frontend still runs without live mic credentials.

---

## Provider Swaps

This is one of the main reasons to use the repo.

1. Add a wrapper in `backend/providers/<kind>/`
2. Register it in the provider registry/config path
3. Switch env vars without changing session semantics

That keeps the realtime loop stable while you change vendors.

---

## What You See In The App

- connection pill for the live session
- text prompt plus browser mic capture
- `Send Text Turn`, hold-to-talk mic icon, `Interrupt`, `New Lesson`
- latency cards and transcript panels
- tutor reply and conversation history
- avatar mode switch between `2D CSS` and `3D Three.js`

The current UI now carries explicit lesson controls, readable history, and demo-ready layout defaults across desktop and mobile.

---

## Repository Structure

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

---

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

See also:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/STACK.md`](docs/STACK.md)
- [`docs/requirements-trace.md`](docs/requirements-trace.md)
- [`docs/progress.md`](docs/progress.md)

---

## Roadmap

- reviewer-facing latency closure for `first_viseme` and `audio_done`
- deeper browser mic smoke coverage
- richer session context and personalization
- stronger live-provider benchmark evidence
- richer live voice rehearsal evidence

---

## Contributing

High-signal areas:

- new provider adapters
- latency instrumentation
- avatar quality and sync
- pedagogy and eval depth
- browser smoke reliability

If you change behavior or an interface, update docs in the same change.
