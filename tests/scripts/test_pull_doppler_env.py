from __future__ import annotations

from scripts import pull_doppler_env


def test_fetch_doppler_secrets_keeps_tls_verification_enabled(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_check_output(args: list[str], *, text: bool) -> str:
        captured["args"] = args
        captured["text"] = text
        return '{"OPENAI_API_KEY":"sk-test"}'

    monkeypatch.setattr(pull_doppler_env.subprocess, "check_output", fake_check_output)

    secrets = pull_doppler_env.fetch_doppler_secrets(project="api_keys", config="dev")

    assert secrets == {"OPENAI_API_KEY": "sk-test"}
    assert captured["text"] is True
    args = captured["args"]
    assert isinstance(args, list)
    assert "--no-file" in args
    assert "--no-verify-tls" not in args
