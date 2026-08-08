# Coolify Fast Deploy

GitHub Actions workflow: `.github/workflows/fast-coolify-deploy.yml`.

Flow:

1. run available repo gates
2. build and push GHCR images with BuildKit and GitHub Actions cache
3. trigger Coolify deploys with Docker tag `sha-<commit>` and `force=false`

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

## Rollback

Use this when a production deploy passes CI but the live app is bad. Roll back by pointing each Coolify app at the previous `sha-<commit>` tag that was known-good in GHCR or in the last green GitHub Actions deploy.

The rollback uses the same SSH deploy script as the forward deploy. Set the target app UUID, image, port, health settings, and the previous image tag, then run the script:

```bash
export DOCKER_TAG=sha-<previous-commit>
export COOLIFY_UUID=<coolify-app-uuid>
export COOLIFY_IMAGE=ghcr.io/maxpetrusenko/<image-name>
export COOLIFY_PORT=<container-port>
export COOLIFY_HEALTH_ENABLED=true
export COOLIFY_HEALTH_PATH=<health-path>
bash scripts/coolify_ssh_deploy.sh
```

Workflow-deployed app/image pairs:

| App | Image | Port | Health |
| --- | --- | --- | --- |
| `session` | `ghcr.io/maxpetrusenko/ai-math-tutor-session` | `8080` | `/api/runtime-options` |
| `web` | `ghcr.io/maxpetrusenko/ai-math-tutor-web` | `3000` | `/api/runtime/status` |
| `avatar-worker` | `ghcr.io/maxpetrusenko/ai-math-tutor-avatar-worker` | `8080` | disabled |

For `avatar-worker`, set `COOLIFY_HEALTH_ENABLED=false` and leave `COOLIFY_HEALTH_PATH` empty. It is a LiveKit worker, not an HTTP service.

After rollback, smoke the canonical production surfaces:

```bash
curl -fsS https://aitutor.maxpetrusenko.com >/dev/null
curl -fsS https://aitutor.maxpetrusenko.com/api/runtime/status
curl -fsS https://aitutor-session.maxpetrusenko.com/api/runtime-options
```

Then run the hosted smoke gate against the same frontend and session service:

```bash
pnpm smoke:prod -- --frontend-url https://aitutor.maxpetrusenko.com --backend-url https://aitutor-session.maxpetrusenko.com/api/lessons
```
