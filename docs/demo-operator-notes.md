# Demo Operator Notes

Last verified: 2026-03-12

## Startup

Use:

```bash
bash scripts/dev.sh
```

Open:

- `http://127.0.0.1:3000/session`
- `http://127.0.0.1:3000/avatar`

## Preflight

Before recording:

- confirm session page loads
- confirm the hero avatar is visible
- confirm prompt box is enabled
- confirm `Send`, `History`, `New`, and `Hold to talk` are visible
- confirm audio is on
- keep DevTools closed

## Controls That Actually Matter

Session page:

- `Send` submits typed turns
- `Hold to talk` is the mic path
- `History` opens the lesson drawer
- `New` archives current work and starts a fresh lesson
- `Escape` interrupts active playback

Avatar page:

- `2D` and `3D` switch render mode
- avatar cards choose the active tutor look

## Recording Order

1. open `/session`
2. run one typed fraction turn
3. run one follow-up turn
4. open `History`
5. close `History`
6. run one more turn and press `Escape`
7. open `/avatar`
8. switch from default 2D to `Human 3D`
9. switch back to `Robot`
10. return to `/session`

## Reliable Demo Prompt Set

- `Fractions still confuse me.`
- `I think one slice out of four is one fourth.`
- `Can you give me one more hint?`

## Recovery

- if session state feels stale, press `Escape`
- if lesson context is noisy, click `New`
- if avatar page looks wrong, hard refresh and reopen `/avatar`
- if app does not load, restart with `bash scripts/dev.sh`

## Operator Warnings

- there is no dedicated on-screen `Interrupt` button in the current session shell
- subject and grade are shown as chips on the session page, not active selectors there
- science and english remain documented in fixtures and eval docs, not as a current live selector flow on `/session`
- public-provider bakeoff remains comparison evidence, not the acceptance lane

## Gate Evidence

Current verified gates:

- `python3 -m pytest -q` -> `174 passed`
- `cd frontend && pnpm verify` -> pass
- `cd frontend && pnpm e2e` -> `10 passed`

## Done Standard

For engineering, the app is ready.  
For submission packaging, the remaining manual step is recording the final demo video from the approved script.
