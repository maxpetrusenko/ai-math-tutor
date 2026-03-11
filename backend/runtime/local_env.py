from __future__ import annotations

import argparse
import os
from pathlib import Path
import shlex
from typing import Mapping, MutableMapping, Sequence

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ENV_FILES = (".env", ".env.local", "frontend/.env.local")
ENV_ALIASES = {
    "GEMINI_API_KEY": "GOOGLE_AI_API_KEY",
    "MINIMAX_SPEECH_API_KEY": "MINIMAX_API_KEY",
}


def load_local_env(
    *,
    base_dir: Path | None = None,
    env: MutableMapping[str, str] | None = None,
    files: Sequence[str] = DEFAULT_ENV_FILES,
) -> list[str]:
    target_env = env if env is not None else os.environ
    root = base_dir or REPO_ROOT
    loaded_paths: list[str] = []

    for relative_path in files:
        path = root / relative_path
        if _load_env_file(path, target_env):
            loaded_paths.append(str(path))

    _apply_env_aliases(target_env)
    return loaded_paths


def shell_export_commands(
    *,
    base_dir: Path | None = None,
    env: Mapping[str, str] | None = None,
    files: Sequence[str] = DEFAULT_ENV_FILES,
) -> str:
    target_env = dict(env or {})
    loaded_paths = load_local_env(base_dir=base_dir, env=target_env, files=files)
    if not loaded_paths:
        return ""

    lines = [f"export {key}={shlex.quote(value)}" for key, value in sorted(target_env.items())]
    return "\n".join(lines)


def _load_env_file(path: Path, env: MutableMapping[str, str]) -> bool:
    if not path.exists():
        return False

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        key, raw_value = line.split("=", 1)
        key = key.strip()
        value = raw_value.strip().strip("'").strip('"')
        if key and key not in env:
            env[key] = value

    return True


def _apply_env_aliases(env: MutableMapping[str, str]) -> None:
    for target_key, source_key in ENV_ALIASES.items():
        if target_key not in env and source_key in env:
            env[target_key] = env[source_key]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Load local .env files for repo entrypoints.")
    parser.add_argument("--shell", action="store_true", help="print shell export commands")
    args = parser.parse_args(argv)

    if args.shell:
        output = shell_export_commands()
        if output:
            print(output)
        return 0

    load_local_env()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
