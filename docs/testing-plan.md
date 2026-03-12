# Testing Plan

Maps each task to the minimum evidence needed before claiming it is complete.

## Core Rule

Every task should land with at least one of:

- unit tests for isolated logic
- integration tests for cross-component contracts
- browser smoke coverage for real user paths
- manual review notes when quality is inherently visual or subjective

## Task Matrix

| Task | Area | Minimum test proof | Manual review |
| --- | --- | --- | --- |
| 01 | benchmark harness | `tests/monitoring/*`, `tests/benchmarks/*`, results template test | inspect p50/p95 output readability |
| 02 | websocket session server | `tests/session/test_server.py`, `tests/session/test_server_pipeline.py` | verify connect / interrupt loop by hand |
| 03 | streaming STT | `tests/stt/test_deepgram_client.py`, transcript commit tests | review transcript stability on short answers |
| 04 | MiniMax path | `tests/llm/test_minimax_client.py`, prompt builder and response policy tests | review question-led tone |
| 05 | Gemini fallback | `tests/llm/test_provider_switch.py` | verify same prompt contract and UX |
| 06 | commit manager | `tests/tts/test_commit_manager.py` | review phrase vs sentence output quality |
| 07 | Cartesia path | `tests/tts/test_cartesia_client.py`, audio buffer tests | review timestamp quality |
| 08 | frontend shell | component tests for `TutorSession`, `MicCapture`, `LatencyMonitor` | review state clarity and responsive layout |
| 09 | avatar renderer | `frontend/components/AvatarRenderer.test.tsx`, avatar timing tests | review mouth motion and state readability |
| 10 | playback + interruption | `frontend/lib/playback_controller.test.ts`, `AudioPlayer` tests | review fade, cut, and audio/avatar stop-together behavior |
| 11 | pedagogy eval pack | `tests/eval/*` | review rubric completeness and subject spread |
| 12 | benchmark report | template test plus report regeneration check | review go / no-go honesty |
| 13 | demo flow | smoke test for the scripted path where possible | rehearse full demo arc |
| 14 | stretch branch spike | branch-specific benchmark and comparison report | review baseline beat, not just novelty |
| 15 | browser mic streaming | browser smoke test covering mic permission and live turn | review permission UX and failure states |
| 16 | frontend latency + sync | integration test for event capture, UI rendering tests | review live numbers against visible behavior |
| 17 | session context + personalization | prompt builder tests, pipeline context tests | review multi-turn context carry-forward |
| 18 | E2E smoke coverage | app-load, demo-turn, interrupt specs | review failure localization quality |
| 19 | startup + env contract | startup smoke command, env parsing tests if added | run from docs on a clean shell |
| 20 | requirements trace + review | trace completeness check | audit requirement-to-proof links |
| 21 | cost / performance note | source-data sanity check against report | review whether tradeoffs are explicit |
| 22 | demo recording + submission pack | artifact existence check | review video pacing and package completeness |

## Missing Test Work Right Now

- browser-level smoke coverage exists for app load, demo turns, interruption, lesson reset, and avatar switching
- live mic capture exists, and component coverage exercises recorded-chunk turns; browser permission UX still needs a higher-fidelity automation pass
- frontend latency cards derive from real session events; broader reviewer-facing sync assertions can still expand beyond the current event coverage
- no clean-shell startup verification command exists yet
- requirements-trace freshness now guards known mic and latency drift, but broader requirement-to-evidence freshness is still manual

## Gate Commands

Backend:

```bash
python3 -m pytest -q
```

Local env contract:

```bash
python3 -m backend.runtime.env_contract --mode local
```

Frontend:

```bash
cd frontend
pnpm test
pnpm typecheck
pnpm build
```

Hosted smoke after deploy:

```bash
pnpm smoke:prod -- --frontend-url https://your-hosted-frontend --expect-firebase --expect-auth
```

Hosted staging gate before prod:

```bash
pnpm deploy:stage --stage-project your-staging-firebase-project --stage-backend-env-file .env.deploy.staging --git-commit "$(git rev-parse HEAD)"
```

Promotion after staging smoke:

```bash
pnpm promote:prod --stage-project your-staging-firebase-project --stage-backend-env-file .env.deploy.staging --prod-project ai-math-tutor-b39b3 --prod-backend-env-file .env.deploy.prod --git-commit "$(git rev-parse HEAD)"
```

Future browser smoke gate after Task 18:

```bash
cd frontend
pnpm playwright test
```
