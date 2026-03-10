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

- use `Run Demo Turn` for each concept
- use `Interrupt` once during the first or second turn
- point to `speech → stt`, `stt → llm`, and `llm → tts` cards
- point to avatar and audio state together

## Recovery

- if connection shows `failed`, refresh the page after backend restart
- if the tutor state sticks, click `Interrupt`
- if frontend deps are missing, run `pnpm install` in `frontend/`
