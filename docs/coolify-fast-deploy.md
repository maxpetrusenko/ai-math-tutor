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
- `ghcr.io/maxpetrusenko/ai-math-tutor-frontend`

Backend and session both build from `backend/Dockerfile`.
Frontend builds from `frontend/Dockerfile`.

## Coolify Apps

Covered by the workflow:

| App | UUID | Dockerfile | Port | Health |
| --- | --- | --- | --- | --- |
| `ai-math-tutor-backend` | `jbglbhx2tegm7olw37rmy9zm` | `backend/Dockerfile` | `8080` | `/api/runtime-options` |
| `ai-math-tutor-session` | `q47hwdffry6w02uc0ykr8rmy` | `backend/Dockerfile` | `8080` | `/api/runtime-options` |
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
