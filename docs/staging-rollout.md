# Staging Rollout

Use a separate Firebase and GCP project for staging.

Why:

- fully scriptable App Hosting config
- no prod secret collisions
- real promotion gate before prod

## Required Files

Create two local env files from `.env.example`:

- `.env.deploy.staging`
- `.env.deploy.prod`

They should contain the backend runtime env for Cloud Run session deploys.
Do not commit them.

Minimum expectation:

- provider API keys
- `NERDY_STT_PROVIDER`
- `NERDY_LLM_PROVIDER`
- `NERDY_RUNTIME_LLM_PROVIDER`
- `NERDY_LLM_FALLBACK_PROVIDER`
- `NERDY_RUNTIME_LLM_FALLBACK_PROVIDER`
- `NERDY_TTS_PROVIDER`
- any runtime flags you need in hosted mode

Do not set these in the file; the rollout script injects them:

- `NERDY_ALLOWED_ORIGINS`
- `NERDY_REQUIRE_FIREBASE_AUTH`

## Stage Only

Deploy backend + frontend to staging and smoke it:

```bash
pnpm deploy:stage \
  --stage-project your-staging-firebase-project \
  --stage-backend-env-file .env.deploy.staging \
  --git-commit "$(git rev-parse HEAD)"
```

What it does:

1. ensures a staging Firebase web app exists
2. ensures the App Hosting backend exists
3. refreshes `FIREBASE_WEBAPP_CONFIG`
4. builds and deploys the session backend to Cloud Run
5. refreshes App Hosting `SESSION_WS_URL`
6. rolls out the frontend commit
7. runs hosted smoke until healthy or timeout

## Full Promotion

Deploy staging first. If smoke passes, deploy the same git commit to prod:

```bash
pnpm promote:prod \
  --stage-project your-staging-firebase-project \
  --stage-backend-env-file .env.deploy.staging \
  --prod-project ai-math-tutor-b39b3 \
  --prod-backend-env-file .env.deploy.prod \
  --git-commit "$(git rev-parse HEAD)"
```

Defaults:

- App Hosting backend: `ai-math-tutor`
- frontend web app display name: `ai-math-tutor`
- session service: `ai-math-tutor-session`
- region: `us-east4`

Override them if staging uses different names:

```bash
pnpm promote:prod \
  --stage-project your-staging-project \
  --stage-backend-env-file .env.deploy.staging \
  --stage-frontend-backend ai-math-tutor-staging \
  --stage-session-service ai-math-tutor-session-staging \
  --prod-project ai-math-tutor-b39b3 \
  --prod-backend-env-file .env.deploy.prod
```

## Notes

- `apphosting.yaml` now reads `NEXT_PUBLIC_SESSION_WS_URL` from the App Hosting secret `SESSION_WS_URL`
- staging and prod each keep their own secret value in their own Firebase project
- hosted smoke still checks runtime status + Firebase config + lesson auth gate
- if you want a same-project staging backend instead, you need App Hosting environment-specific config in console; this repo flow does not automate that path
