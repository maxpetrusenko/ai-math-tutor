from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

DEFAULT_KEYS = (
    "DEEPGRAM_API_KEY",
    "MINIMAX_API_KEY",
    "CARTESIA_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_AI_API_KEY",
    "GEMINI_API_KEY",
    "LANGSMITH_API_KEY",
)


def fetch_doppler_secrets(*, project: str, config: str) -> dict[str, str]:
    raw = subprocess.check_output(
        [
            "doppler",
            "secrets",
            "download",
            "--project",
            project,
            "--config",
            config,
            "--format",
            "json",
            "--no-file",
            "--no-verify-tls",
        ],
        text=True,
    )
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise RuntimeError("expected Doppler to return a JSON object")
    return {str(key): str(value) for key, value in payload.items()}


def write_env_file(path: Path, *, secrets: dict[str, str], keys: tuple[str, ...]) -> tuple[list[str], list[str]]:
    found = [key for key in keys if secrets.get(key)]
    missing = [key for key in keys if key not in found]
    lines = [f"{key}={secrets[key]}" for key in found]
    path.write_text("\n".join(lines) + ("\n" if lines else ""))
    return found, missing


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Pull selected AI keys from Doppler into .env.local.")
    parser.add_argument("--project", default="api_keys", help="Doppler project name")
    parser.add_argument("--config", default="dev", help="Doppler config name")
    parser.add_argument("--output", default=".env.local", help="target env file")
    parser.add_argument(
        "--keys",
        nargs="*",
        default=list(DEFAULT_KEYS),
        help="explicit secret keys to write",
    )
    args = parser.parse_args(argv)

    secrets = fetch_doppler_secrets(project=args.project, config=args.config)
    found, missing = write_env_file(Path(args.output), secrets=secrets, keys=tuple(args.keys))

    print(f"wrote {len(found)} keys to {args.output}")
    if found:
        print("found: " + ", ".join(found))
    if missing:
        print("missing: " + ", ".join(missing))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
