#!/usr/bin/env bash
set -euo pipefail

require_env() {
  local key="$1"
  if [ -z "${!key:-}" ]; then
    echo "::error::Set ${key}"
    exit 1
  fi
}

require_env COOLIFY_API_TOKEN
require_env COOLIFY_SSH_PRIVATE_KEY
require_env COOLIFY_UUID
require_env COOLIFY_IMAGE
require_env DOCKER_TAG
require_env COOLIFY_PORT
require_env COOLIFY_HEALTH_ENABLED

COOLIFY_SSH_HOST="${COOLIFY_SSH_HOST:-173.249.52.27}"
COOLIFY_SSH_USER="${COOLIFY_SSH_USER:-root}"
COOLIFY_HEALTH_PATH="${COOLIFY_HEALTH_PATH:-}"

install -m 700 -d ~/.ssh
key_file="$HOME/.ssh/coolify_deploy_key"
printf '%s\n' "${COOLIFY_SSH_PRIVATE_KEY}" > "${key_file}"
chmod 600 "${key_file}"

if [ -n "${COOLIFY_SSH_KNOWN_HOSTS:-}" ]; then
  printf '%s\n' "${COOLIFY_SSH_KNOWN_HOSTS}" >> ~/.ssh/known_hosts
else
  ssh-keyscan -H "${COOLIFY_SSH_HOST}" >> ~/.ssh/known_hosts
fi

payload="$(
  python3 - <<'PY'
import json
import os

print(json.dumps({
    "build_pack": "dockerimage",
    "docker_registry_image_name": os.environ["COOLIFY_IMAGE"],
    "docker_registry_image_tag": os.environ["DOCKER_TAG"],
    "ports_exposes": os.environ["COOLIFY_PORT"],
    "health_check_enabled": os.environ["COOLIFY_HEALTH_ENABLED"].lower() == "true",
    "health_check_path": os.environ.get("COOLIFY_HEALTH_PATH", ""),
}))
PY
)"

token_b64="$(printf '%s' "${COOLIFY_API_TOKEN}" | base64 | tr -d '\n')"
payload_b64="$(printf '%s' "${payload}" | base64 | tr -d '\n')"
ssh_target="${COOLIFY_SSH_USER}@${COOLIFY_SSH_HOST}"

ssh_opts=(
  -i "${key_file}"
  -o BatchMode=yes
  -o ConnectTimeout=10
  -o IdentitiesOnly=yes
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=2
  -o StrictHostKeyChecking=yes
)

echo "Deploying ${COOLIFY_IMAGE}:${DOCKER_TAG} through ${COOLIFY_SSH_HOST}"
# Keep the encoded Coolify token off the ssh process argv; argv is visible to process listings.
{
  printf 'COOLIFY_API_TOKEN_B64=%q\n' "${token_b64}"
  printf 'COOLIFY_UUID=%q\n' "${COOLIFY_UUID}"
  printf 'PAYLOAD_B64=%q\n' "${payload_b64}"
  cat <<'REMOTE'
set -euo pipefail

COOLIFY_API_TOKEN="$(printf '%s' "${COOLIFY_API_TOKEN_B64}" | base64 -d)"
payload="$(printf '%s' "${PAYLOAD_B64}" | base64 -d)"
api_base="http://127.0.0.1:8000/api/v1"

curl --connect-timeout 10 --max-time 30 --fail --silent --show-error \
  --request PATCH \
  --url "${api_base}/applications/${COOLIFY_UUID}" \
  --header "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --data "${payload}"

curl --connect-timeout 10 --max-time 30 --fail --silent --show-error \
  --request POST \
  --url "${api_base}/deploy?uuid=${COOLIFY_UUID}&force=false" \
  --header "Authorization: Bearer ${COOLIFY_API_TOKEN}"
REMOTE
} | ssh "${ssh_opts[@]}" "${ssh_target}" "bash -s"
