# Session Data Persistence

`backend/session/persistence.py` keeps lesson state in a single JSON store on
local disk. Hosted deployments must back that directory with persistent
storage; otherwise every container recreation silently resets student lesson
data to empty.

## What is stored

The session store file is `session-store.json`. It holds:

- the active lesson thread (conversation, lesson state, transcript)
- the recent lesson archive (last 8 archived lessons)
- per-session snapshots used to restore a session after a reconnect

The session server also writes related runtime artifacts. Their own env vars
control their paths, and both default to the working-directory `.nerdy-data/`
independently of `NERDY_SESSION_DATA_DIR`. They are not required for
correctness:

- AI call log (`NERDY_AI_LOG_PATH`, default `.nerdy-data/ai-calls.jsonl`)
- session turn traces (debug artifacts)

## Where the directory resolves

1. `NERDY_SESSION_DATA_DIR` when set (absolute, or relative to the process
   working directory)
2. otherwise `$CWD/.nerdy-data`

The session image sets `WORKDIR /app` and starts the server from there, so the
in-container default is `/app/.nerdy-data`. Mounting persistent storage at the
default path is sufficient; `NERDY_SESSION_DATA_DIR` is only needed when the
storage lives at a different path. When the env var is not set, the server
logs a warning at the first store access, so an unbacked store path is visible
in deployment logs.

## Requirement for hosted deployments

Any hosted deployment that serves lesson state must mount "Persistent Storage"
at the resolved data directory (default `/app/.nerdy-data`):

- Coolify: add a "Persistent Storage" entry to the lesson-serving app whose
  mount path equals the data directory. `ai-math-tutor-session` serves the
  lesson API; `ai-math-tutor-backend` runs the same session server image and
  needs the same mount if it serves lesson state (otherwise keep it out of the
  lesson-serving path). The frontend selects its lesson API host with
  `NEXT_PUBLIC_LESSON_API_URL`; check that value to confirm which app must be
  durable.
- If `NERDY_SESSION_DATA_DIR` is set to a custom path, the Persistent Storage
  mount must use that exact path.

Without a mount, the write path still works; it just writes into the container
filesystem. On container recreation (a Coolify redeploy, a new image tag, or
any recreate of the container) the filesystem resets, and the server starts
with a fresh, valid, empty store. There is no error surfaced to users: saved
lessons and history simply disappear.

## Verify the current mount

On the Coolify host, for each lesson-serving container:

```bash
docker inspect <container> --format '{{range .Mounts}}{{.Type}} {{.Source}} -> {{.Destination}}{{println}}{{end}}'
```

A durable deployment shows a mount (volume or bind) whose destination is
`/app/.nerdy-data` (or the configured `NERDY_SESSION_DATA_DIR`). No matching
mount means lesson data is container-local and will be lost on the next
recreate.

Optional end-to-end probe during a landing pass: create a marker file inside
the data directory, run a redeploy, then confirm the marker still exists.

## Backup and recovery

- Back up `session-store.json` by copying it from the mount source that
  `docker inspect` reports (the host path for a bind mount, or
  `/var/lib/docker/volumes/<name>/_data` for a docker volume).
- Restore by placing `session-store.json` back into the data directory while
  the session container is stopped; the server reads it on the next request.
- Treat the store as user data: include it in host backups before any storage
  migration, volume rename, or container recreation.

## Related

- Deploy flow: `docs/coolify-fast-deploy.md`
