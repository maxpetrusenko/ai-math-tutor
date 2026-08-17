from __future__ import annotations

from pathlib import Path

from backend.runtime.local_env import load_local_env, shell_export_commands


def test_load_local_env_reads_root_env_file_and_aliases(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text(
        "DEEPGRAM_API_KEY=dg-test\nGOOGLE_AI_API_KEY=gemini-source\nMINIMAX_API_KEY=minimax-source\n"
    )
    env: dict[str, str] = {}

    loaded = load_local_env(base_dir=tmp_path, env=env)

    assert loaded == [str(tmp_path / ".env")]
    assert env["DEEPGRAM_API_KEY"] == "dg-test"
    assert env["GEMINI_API_KEY"] == "gemini-source"
    assert env["MINIMAX_SPEECH_API_KEY"] == "minimax-source"


def test_load_local_env_does_not_override_existing_environment(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text("DEEPGRAM_API_KEY=dg-from-file\n")
    env = {"DEEPGRAM_API_KEY": "dg-existing"}

    load_local_env(base_dir=tmp_path, env=env)

    assert env["DEEPGRAM_API_KEY"] == "dg-existing"


def test_load_local_env_allows_later_files_to_override_earlier_loaded_values(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text("DEEPGRAM_API_KEY=dg-base\n")
    (tmp_path / ".env.local").write_text("DEEPGRAM_API_KEY=dg-local\n")
    env: dict[str, str] = {}

    load_local_env(base_dir=tmp_path, env=env, files=(".env", ".env.local"))

    assert env["DEEPGRAM_API_KEY"] == "dg-local"


def test_shell_export_commands_include_loaded_values(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text("DEEPGRAM_API_KEY=dg-shell\n")

    exports = shell_export_commands(base_dir=tmp_path)

    assert "export DEEPGRAM_API_KEY=dg-shell" in exports


def test_root_env_example_documents_turn_trace_opt_in() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    env_example = (repo_root / ".env.example").read_text()

    assert "NERDY_ENABLE_TURN_TRACES=0" in env_example
    assert "Set NERDY_ENABLE_TURN_TRACES=1" in env_example
