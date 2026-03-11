# Demo Operator Notes

## Local Startup

One command:

```bash
bash scripts/dev.sh
```

Manual split:

```bash
uvicorn backend.session.server:app --reload --port 8000

cd frontend
pnpm dev --hostname 127.0.0.1 --port 3000
```

Open:

- `http://localhost:3000`

## Before Demo

- confirm backend is listening on port `8000`
- confirm frontend loads and shows `connected`
- keep the first prompt ready in the textarea
- keep DevTools closed unless debugging

## During Demo

- use `Send Text Turn` for the primary math lesson so the history panel proves follow-up continuity
- use the hold-to-talk mic icon only for the voice-path backup or interruption pass
- use `New Lesson` between concepts to clear context
- use `Interrupt` once during the first or second turn
- point to `speech → stt`, `stt → llm`, and `llm → tts` cards
- point to avatar and audio state together
- point to the conversation history after turn 2 of the math arc

## Locked Demo Presets

- primary avatar: `human-css-2d`
- alternate 2D: `robot-css-2d`
- alternate 3D: `human-threejs-3d`
- primary concept: linear equations
- backup concepts: photosynthesis basics, subject-verb agreement

## Recovery

- if connection shows `failed`, refresh the page after backend restart
- if the tutor state sticks, click `Interrupt`
- if the lesson context is noisy, click `New Lesson`
- if frontend deps are missing, run `pnpm install` in `frontend/`
