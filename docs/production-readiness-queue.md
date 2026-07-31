# Production Readiness Queue

This repo has enough production-readiness work open that the next risk is no longer finding another tiny fix. The risk is landing the wrong thing first, duplicating an existing branch, or treating a green draft PR as production proof.

Do not deploy or merge from this queue until the PR-specific gates pass, the branch is rebased or retargeted onto the current base, and the PR body names the residual production risk.

## Current production baseline

Read-only probes from the production-readiness loop show this shape:

- `https://aitutor.maxpetrusenko.com` returns `200` and is the canonical user-facing frontend.
- `https://aitutor-session.maxpetrusenko.com` returns `404` at the service root.
- The listed Contabo/sslip roots return 404, so treat them as unresolved routing inventory, not deployment success evidence.
- Healthcheck, smoke, deploy-doc, cache, and rollback hardening already have open PRs or issues. Search GitHub before adding another deploy-side branch.

## Landing order

Prefer this order when production-readiness branches are ready to merge:

1. #12, `ci: add pull request verification gate`.
   - Why first: every later change is safer when GitHub runs backend tests, frontend tests, typecheck, and production build before merge.
   - Before merge: confirm the workflow file can be pushed by a token with `workflow` scope and GitHub Actions reports green.

2. #23, `docs: align Coolify deploy runbook with workflow`.
   - Why second: operators need the source-controlled deploy contract to match the actual Coolify SSH workflow before more deploy-side changes stack on it.
   - Before merge: reconcile any changed workflow UUIDs, image names, and required secrets against `.github/workflows/fast-coolify-deploy.yml`.

3. #38, `fix: add backend image healthcheck`.
   - Why third: container-native backend readiness improves diagnosis and rollback after the deploy contract is documented.
   - Before merge: keep the health target aligned with the endpoint Coolify uses for backend/session readiness.

4. #36, `perf: cache CI backend pip installs`.
   - Why fourth: it improves repeat gate speed without changing runtime behavior, but it is less fundamental than getting the gate and deploy docs right.
   - Before merge: verify the setup-python cache key still points at `pyproject.toml`.

5. #37, `Document Coolify rollback path for bad production deploys`.
   - Why fifth: rollback docs should build on the corrected deploy runbook in #23 rather than race it.
   - Before implementation: keep this docs-only unless the active Coolify API shape has changed.

6. #11, `production: reconcile listed Contabo/sslip domains returning 404`.
   - Why last here: this is deployment inventory and routing truth, not a local source-only patch. It needs host evidence before code changes.
   - Before fix: map each listed domain to `ai-math-tutor-backend`, `ai-math-tutor-frontend`, `ai-math-tutor-session`, or `ai-math-tutor-web` in Coolify.

## Duplicate guard

No new deploy-side PR should duplicate #11, #23, #37, or the open healthcheck/smoke stack.

Before opening another production-readiness branch, run:

```bash
gh pr list --repo maxpetrusenko/ai-math-tutor --state all \
  --search "healthcheck OR smoke OR Coolify OR rollback OR cache OR Contabo OR sslip" \
  --json number,title,state,headRefName,url

gh issue list --repo maxpetrusenko/ai-math-tutor --state all \
  --search "healthcheck OR smoke OR Coolify OR rollback OR cache OR Contabo OR sslip" \
  --json number,title,state,url
```

If the next candidate touches a file already owned by one of those PRs, either retarget onto that branch or create a precise issue with evidence. Do not open a sibling PR that edits the same deploy contract.

## Safe evidence rules

- Use `https://aitutor.maxpetrusenko.com` as canonical frontend evidence.
- Use service-specific API endpoints for backend/session evidence, not service roots that are known to return 404.
- Treat production deploys, Coolify PATCH calls, and workflow dispatch as out of scope for draft PR creation.
- Prefer source-level tests for docs and workflow contracts when host credentials are unavailable.
- Keep each PR body explicit: problem, evidence, baseline or impact, files changed, tests, autoreview result, residual risk.
