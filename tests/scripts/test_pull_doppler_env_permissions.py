from __future__ import annotations

import os
import stat

from scripts.pull_doppler_env import write_env_file


def test_write_env_file_tightens_existing_secret_file_permissions(tmp_path) -> None:
    env_path = tmp_path / ".env.local"
    env_path.write_text("OPENAI_API_KEY=old\n")
    env_path.chmod(0o644)

    found, missing = write_env_file(
        env_path,
        secrets={"OPENAI_API_KEY": "sk-test"},
        keys=("OPENAI_API_KEY",),
    )

    assert found == ["OPENAI_API_KEY"]
    assert missing == []
    assert env_path.read_text() == "OPENAI_API_KEY=sk-test\n"
    assert stat.S_IMODE(env_path.stat().st_mode) == 0o600


def test_write_env_file_creates_new_secret_file_without_world_readable_window(
    tmp_path,
    monkeypatch,
) -> None:
    env_path = tmp_path / ".env.local"

    def reject_umask_based_write(*args, **kwargs) -> None:
        raise AssertionError("Path.write_text creates files with process umask permissions")

    monkeypatch.setattr(type(env_path), "write_text", reject_umask_based_write)
    previous_umask = os.umask(0)
    try:
        found, missing = write_env_file(
            env_path,
            secrets={"OPENAI_API_KEY": "sk-test"},
            keys=("OPENAI_API_KEY",),
        )
    finally:
        os.umask(previous_umask)

    assert found == ["OPENAI_API_KEY"]
    assert missing == []
    assert env_path.read_text() == "OPENAI_API_KEY=sk-test\n"
    assert stat.S_IMODE(env_path.stat().st_mode) == 0o600
