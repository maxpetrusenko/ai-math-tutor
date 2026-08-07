# Coolify Fast Deploy

GitHub Actions workflow: `.github/workflows/fast-coolify-deploy.yml`.

Flow:

1. run available repo gates
2. build and push GHCR images with BuildKit and GitHub Actions cache
3. trigger Coolify deploys with Docker tag `sha-<commit>` and `force=false`
4. smoke the canonical production frontend and session endpoints

## Gates

The workflow runs these before any image push:

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `python3 -m pytest`

## Images

All images are pushed under `ghcr.io/maxpetrusenko/` with tag `sha-${{ github.sha }}`:

- `ghcr.io/maxpetrusenko/ai-math-tutor-backend`
- `ghcr.io/maxpetrusenko/ai-math-tutor-session`
- `ghcr.io/maxpetrusenko/ai-math-tutor-avatar-worker`
- `ghcr.io/maxpetrusenko/ai-math-tutor-frontend`

Backend and session both build from `backend/Dockerfile`.
The LiveKit avatar worker builds from `backend/Dockerfile.worker`.
Frontend builds from `frontend/Dockerfile`.

## Coolify Apps

Covered by the workflow:

| App | UUID | Dockerfile | Port | Health |
| --- | --- | --- | --- | --- |
| `ai-math-tutor-backend` | `jbglbhx2tegm7olw37rmy9zm` | `backend/Dockerfile` | `8080` | `/api/runtime-options` |
| `ai-math-tutor-session` | `q47hwdffry6w02uc0ykr8rmy` | `backend/Dockerfile` | `8080` | `/api/runtime-options` |
| `ai-math-tutor-avatar-worker` | `yw36ciy2dqqcq9ituuwzdsru` | `backend/Dockerfile.worker` | `8080` | disabled |
| `ai-math-tutor-frontend` | `nz1pemtpromq4ujwpu83zphm` | `frontend/Dockerfile` | `3000` | `/api/runtime/status` |

Blocked:

- `ai-math-tutor-web` (`ecedjb8684h04h01m508baih`) is configured for `/Dockerfile`, but this repo has no root `Dockerfile`. Add a root Dockerfile or point that Coolify app at `frontend/Dockerfile` or a prebuilt image before adding it to the workflow matrix.
- `ai-math-tutor-frontend` is currently noted as Nixpacks in Coolify. The workflow builds and pushes a GHCR image, so Coolify must be configured to deploy that image/tag for the pushed image to be used.

## Post-deploy smoke

After the Coolify deploy matrix completes, the workflow runs against the image tag stamped into the frontend runtime status:

```bash
python3 scripts/smoke_coolify.py \
  --frontend-url "$FRONTEND_SMOKE_URL" \
  --session-url "$SESSION_SMOKE_URL" \
  --expect-revision "$DOCKER_TAG"
```

Defaults:

- frontend: `https://aitutor.maxpetrusenko.com`
- session: `https://aitutor-session.maxpetrusenko.com`

Override with repo variables `PROD_FRONTEND_SMOKE_URL` and `PROD_SESSION_SMOKE_URL` if the canonical domains change. The smoke keeps to safe read-only probes: frontend root, frontend `/api/runtime/status`, and session `/api/runtime-options`, and rejects insecure `ws://` runtime wiring when the frontend is HTTPS or when `sessionWsUrl` drifts away from `/ws/session`. It waits until `/api/runtime/status.revision` matches the expected `sha-<commit>` Docker tag, so the job validates the rollout it just triggered instead of an older healthy deployment. It intentionally does not probe the listed sslip URLs while issue #11 owns that routing inventory gap. If `COOLIFY_SSH_PRIVATE_KEY` is absent, the workflow skips both the deploy and the post-deploy smoke so it does not fail against unrelated existing production state.

## Required GitHub Config

Repo variable or secret:

- `COOLIFY_URL`, for example `https://coolify.example.com`

Repo secret:

- `COOLIFY_TOKEN`

`GITHUB_TOKEN` is used for GHCR push, with workflow `packages: write` permission.

## Deploy API

The workflow calls Coolify `POST /api/v1/deploy?force=false` with:

```json
{
  "uuid": "<coolify-app-uuid>",
  "tag": "sha-<commit>"
}
```

Coolify docs: https://coolify.io/docs/api-reference/api/operations/deploy-by-tag-or-uuid
