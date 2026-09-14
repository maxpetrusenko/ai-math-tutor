# Production Incident Triage

Read-only triage for the canonical hosted deploys (`aitutor.maxpetrusenko.com`,
`aitutor-session.maxpetrusenko.com`). Walk the request path one layer at a time and
identify the failing layer before anything is restarted.

## When to use this runbook

- A canonical URL returns an error, times out, or does not resolve.
- The session API or websocket misbehaves outside a deploy window.
- Someone asks "is the tutor down, and why?" and the answer needs layers, not guesses.

Motivating incident: issue #75 (September 2026: both apps returned 503, and later their
DNS records disappeared, while nothing in the repo surfaced the failure for days).

## Ground rules

- Layers 0 to 2 are read-only and safe to run against production from any machine.
- Capture container state and recent logs before restarting anything. A restart destroys
  the evidence needed for the root cause.
- Never paste secret values (keys, tokens, connection strings) into issues, logs, or chat.
- After recovery, the fix must be reproducible in local/dev from the same commit: no
  prod-only fixes.

## Layer 0: reproduce from outside

```bash
curl -sS -o /dev/null -m 10 -w "frontend %{http_code}\n" https://aitutor.maxpetrusenko.com/
curl -sS -o /dev/null -m 10 -w "runtime  %{http_code}\n" https://aitutor.maxpetrusenko.com/api/runtime/status
curl -sS -o /dev/null -m 10 -w "options  %{http_code}\n" https://aitutor-session.maxpetrusenko.com/api/runtime-options
curl -sS -o /dev/null -m 10 -w "lessons  %{http_code}\n" https://aitutor-session.maxpetrusenko.com/api/lessons
```

Healthy production: all four return `200`. Record the exact time of the first run; every
later layer output is more useful with a timestamp.

## Layer 1: DNS

```bash
dig +short aitutor.maxpetrusenko.com
dig +short aitutor-session.maxpetrusenko.com

# DNS-over-HTTPS works even when a local resolver is stale or hijacked.
curl -sS "https://cloudflare-dns.com/dns-query?name=aitutor.maxpetrusenko.com&type=A" -H 'accept: application/dns-json'
curl -sS "https://dns.google/resolve?name=aitutor.maxpetrusenko.com&type=A"
```

Interpretation:

- `status: 0` with an address (or CNAME) in `Answer`: the record exists, continue to
  layer 2.
- `status: 3` (NXDOMAIN) or no answer: the record is missing from the `maxpetrusenko.com`
  zone on Cloudflare. This must be fixed in DNS first; no app-side action can help while
  the name does not resolve. Check the Cloudflare audit log to see when and how the record
  disappeared.
- Use sibling subdomains as controls: `chatbox.maxpetrusenko.com`, `colabboard.maxpetrusenko.com`,
  and `software-factory.maxpetrusenko.com` normally resolve. If siblings are also gone,
  suspect a zone-level change; if only some names are gone, treat it as removed or lost
  records and compare against the last known inventory.
- 2026-09-14 example: both `aitutor` records were NXDOMAIN while the sibling controls
  above still resolved, so the zone itself was healthy and only specific records were
  missing.

## Layer 2: edge vs origin

Compare the public edge response with the origin response, bypassing DNS and Cloudflare
while keeping SNI:

```bash
curl -sS -o /dev/null -m 10 -w "edge   %{http_code}\n" https://aitutor.maxpetrusenko.com/

curl -sS -k -o /dev/null -m 10 -w "origin %{http_code}\n" \
  --resolve aitutor.maxpetrusenko.com:443:173.249.52.27 \
  https://aitutor.maxpetrusenko.com/
```

Interpretation:

- Origin `503` with body `no available server`: the host reverse proxy knows the hostname
  but has no healthy app container to route to. Go to layer 3: the apps are down.
- Origin `404` with body `page not found`: the proxy has no router for this hostname.
  Check the Coolify app domain configuration. (The legacy sslip aliases answer this way;
  they are tracked in issue #11.)
- Origin connection refused or timeout: the proxy itself is down; check the `coolify-proxy`
  container on the host.
- Edge `522`/`523` but a working origin: Cloudflare cannot reach the origin; check host
  reachability and ports before touching the apps.
- Edge failure with a working origin and correct DNS: the problem is at the CDN layer
  (proxy state, certificate, access rules), not the app.

## Layer 3: origin host (Coolify)

Read-only inspection on the Coolify host (`vmi3203669`, `173.249.52.27`):

- Open the Coolify dashboard (`http://173.249.52.27:8000`) and find the apps that serve
  the canonical domains: `ai-math-tutor-web` (frontend) and `ai-math-tutor-session`.
- Verify the live app UUID inside Coolify before acting on it. Historically the repo
  docs, the fast deploy workflow matrix, and the fleet deployment catalog have disagreed
  on session/web UUIDs, so trust only what the dashboard shows.
- Read the container state and the most recent logs for the affected apps (for example
  `docker inspect <container>` and `docker logs --tail 100 <container>` through the fleet
  access path) and save them somewhere durable first.
- Then recover: start or restart the stopped containers, or redeploy the last known-good
  image tag. Watch the first minutes of logs for a crash loop.
- If the app is crash-looping, keep the logs: disk pressure, memory pressure, a bad image
  pull, or a failed health check are the usual causes.
- Other apps on the same host (chatbox, colabboard, software-factory) staying healthy
  narrows the failure to this app rather than the host or proxy.

## Layer 4: application

Once the hosts answer again, verify the app contracts:

```bash
curl -sS https://aitutor.maxpetrusenko.com/api/runtime/status
curl -sS https://aitutor-session.maxpetrusenko.com/api/runtime-options

pnpm smoke:prod -- --frontend-url https://aitutor.maxpetrusenko.com --backend-url https://aitutor-session.maxpetrusenko.com/api/lessons
```

- `/api/runtime/status` returns JSON with a `sessionWsUrl` that must point at the session
  host.
- `/api/runtime-options` returns 200; this is the Coolify health path for the session app.
- The hosted smoke exercises the frontend, runtime metadata, the lessons API, and the
  websocket handshake. Any failure there means the incident is not over.

## Decision matrix

| Symptom | Likely layer | First move |
| --- | --- | --- |
| NXDOMAIN on the canonical name | DNS | Restore the record in the Cloudflare zone; treat app restarts as blocked until DNS is back |
| `503 no available server` from origin or edge | Origin apps | Inspect, then restart or redeploy the Coolify app; capture state and logs before restarting |
| `404 page not found` from origin | Edge config | Check the app domain config in Coolify; confirm which hostname belongs to which app |
| `522`/`523` from the edge only | Host reachability | Check the host and proxy before touching apps |
| 5xx only inside the app (API calls, websocket resets) | Application | App logs and health endpoints; check provider keys and upstream status |
| Hosts look up but lesson or session state is stale | Application cache | Check cache headers and the lesson API, not the hosts |

## Evidence and escalation

Collect before acting and keep with the incident:

- The exact commands and outputs for every layer above, with timestamps.
- Control checks: sibling subdomains, sibling apps on the same host.
- Last known-good time and first observed failure time (previous probes, smoke runs,
  workflow runs).
- Whether a deploy was involved (check Actions runs) or nothing shipped since the last
  good state.

Then file or update a single incident issue on this repo with Problem, Evidence, Impact,
Remediation, and Prevention sections. Do not scatter partial reports across issues.

Related runbooks: deploy and rollback live in `docs/coolify-fast-deploy.md`. A scheduled
production health check to catch silent outages is tracked from issue #75.
