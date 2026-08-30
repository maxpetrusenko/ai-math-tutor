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

Repo secrets:

- `COOLIFY_API_TOKEN` or `COOLIFY_TOKEN`, used by `scripts/coolify_ssh_deploy.sh` against the local Coolify API on the VPS.
- `COOLIFY_SSH_PRIVATE_KEY`, used to SSH to the Contabo host. The deploy job intentionally fails when this secret is absent, because a green deploy job that skipped production is worse than a red one.
- `COOLIFY_SSH_KNOWN_HOSTS`, pinned host keys for the Contabo host. Keep this populated instead of trusting runtime `ssh-keyscan` output.

Optional repo secrets:

- `COOLIFY_SSH_HOST`, default `173.249.52.27`
- `COOLIFY_SSH_USER`, default `root`

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
