# Coolify Fast Deploy

GitHub Actions workflow: `.github/workflows/fast-coolify-deploy.yml`.

Flow:

1. run available repo gates
2. build and push GHCR images with BuildKit and GitHub Actions cache
3. connect to the Contabo/Coolify host over SSH
4. patch each covered Coolify app to the matching GHCR image tag
5. trigger Coolify deploys with `force=false`

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
- `ghcr.io/maxpetrusenko/ai-math-tutor-web`

Backend and session both build from `backend/Dockerfile`.
The LiveKit avatar worker builds from `backend/Dockerfile.worker`.
Frontend builds from `frontend/Dockerfile`.

## Coolify Apps

Deployed by the workflow:

| App | UUID | Dockerfile | Port | Health |
| --- | --- | --- | --- | --- |
| `session` | `gx7frryikdt0o7uqtgumzi72` | `backend/Dockerfile` | `8080` | `/api/runtime-options` |
| `web` | `rx0jx3ghadj7r2uemnhsl9kt` | `frontend/Dockerfile` | `3000` | `/api/runtime/status` |
| `avatar-worker` | `yw36ciy2dqqcq9ituuwzdsru` | `backend/Dockerfile.worker` | `8080` | disabled |

Built but not deployed by the workflow:

| App/image | Status |
| --- | --- |
| `ai-math-tutor-backend` | image is built and pushed, but no deploy matrix entry exists yet |
| `ai-math-tutor-frontend` | image is built and pushed, but no deploy matrix entry exists yet |

Blocked:

- The listed sslip backend/frontend domains currently return 404 from outside the host. Keep them out of the deploy matrix until the Coolify app UUIDs, build pack, and health path are confirmed against production.
- Do not add a Coolify app to the deploy matrix unless its UUID, port, image, and health endpoint are verified. A wrong UUID here can deploy the right image to the wrong public app.

## Required GitHub Config

Repo secrets:

- `COOLIFY_SSH_PRIVATE_KEY`, a deploy key that can SSH to the Coolify host
- `COOLIFY_API_TOKEN` or legacy `COOLIFY_TOKEN`, for the local Coolify API call over SSH

Optional repo secrets:

- `COOLIFY_SSH_KNOWN_HOSTS`, to pin host keys instead of relying on `ssh-keyscan`
- `COOLIFY_SSH_HOST`, defaults to `173.249.52.27`
- `COOLIFY_SSH_USER`, defaults to `root`

`GITHUB_TOKEN` is used for GHCR push, with workflow `packages: write` permission.

## Deploy API

The workflow runs `scripts/coolify_ssh_deploy.sh`. That script SSHes to the Coolify host, then calls the local Coolify API at `http://127.0.0.1:8000/api/v1`:

1. `PATCH /applications/<uuid>` to set image name, image tag, exposed port, and health check settings.
2. `POST /deploy?uuid=<uuid>&force=false` to trigger the deploy.

The application patch payload is:

```json
{
  "build_pack": "dockerimage",
  "docker_registry_image_name": "ghcr.io/maxpetrusenko/<image>",
  "docker_registry_image_tag": "sha-<commit>",
  "ports_exposes": "<port>",
  "health_check_enabled": true,
  "health_check_path": "<path>"
}
```
