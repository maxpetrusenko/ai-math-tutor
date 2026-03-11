from __future__ import annotations

import argparse
import json
import os
from collections.abc import Mapping

REQUIRED_FIREBASE_JSON_FIELDS = (
    "apiKey",
    "appId",
    "authDomain",
    "messagingSenderId",
    "projectId",
    "storageBucket",
)

REQUIRED_FIREBASE_PUBLIC_ENV_KEYS = (
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
)


def firebase_auth_required(env: Mapping[str, str]) -> bool:
    return env.get("NERDY_REQUIRE_FIREBASE_AUTH", "0").strip().lower() in {"1", "true", "yes", "on"}


def has_firebase_web_config(env: Mapping[str, str]) -> bool:
    for key in ("FIREBASE_WEBAPP_CONFIG", "NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG"):
        raw_value = env.get(key, "").strip()
        if not raw_value:
            continue
        try:
            parsed = json.loads(raw_value)
        except json.JSONDecodeError:
            continue
        if all(str(parsed.get(field, "")).strip() for field in REQUIRED_FIREBASE_JSON_FIELDS):
            return True

    return all(env.get(key, "").strip() for key in REQUIRED_FIREBASE_PUBLIC_ENV_KEYS)


def collect_env_contract_errors(*, mode: str, env: Mapping[str, str] | None = None) -> list[str]:
    resolved_env = env or os.environ
    errors: list[str] = []

    if mode == "prod" and not resolved_env.get("NEXT_PUBLIC_SESSION_WS_URL", "").strip():
        errors.append("NEXT_PUBLIC_SESSION_WS_URL is required in prod mode.")

    if firebase_auth_required(resolved_env) and not has_firebase_web_config(resolved_env):
        errors.append(
            "Firebase auth requires FIREBASE_WEBAPP_CONFIG, NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG, or the full NEXT_PUBLIC_FIREBASE_* set."
        )

    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate the frontend/backend env contract.")
    parser.add_argument("--mode", choices=("local", "prod"), default="local")
    args = parser.parse_args(argv)

    errors = collect_env_contract_errors(mode=args.mode)
    if errors:
        for error in errors:
            print(f"env-contract: {error}")
        return 1

    print(f"env-contract: ok ({args.mode})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
