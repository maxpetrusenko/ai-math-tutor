#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
HOST="${HOST:-127.0.0.1}"
FRONTEND_DIR="${ROOT_DIR}/frontend"
NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-dev}"
FRONTEND_CACHE_DIR="${FRONTEND_DIR}/${NEXT_DIST_DIR}"
FRONTEND_URL="http://${HOST}:${FRONTEND_PORT}"

cleanup() {
  jobs -pr | xargs -r kill >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

cd "${ROOT_DIR}"
if command -v python3 >/dev/null 2>&1; then
  eval "$(python3 -m backend.runtime.local_env --shell)"
  python3 -m backend.runtime.env_contract --mode local
fi
uvicorn backend.session.server:app --host "${HOST}" --port "${BACKEND_PORT}" &
BACKEND_PID=$!

if [ -d "${FRONTEND_CACHE_DIR}" ] && command -v trash >/dev/null 2>&1; then
  trash "${FRONTEND_CACHE_DIR}" >/dev/null 2>&1 || true
fi

cd "${FRONTEND_DIR}"
export NEXT_DIST_DIR
pnpm dev --hostname "${HOST}" --port "${FRONTEND_PORT}" &
FRONTEND_PID=$!

for _ in $(seq 1 30); do
  if curl --silent --output /dev/null --fail "${FRONTEND_URL}"; then
    break
  fi
  sleep 1
done

wait "${FRONTEND_PID}"
