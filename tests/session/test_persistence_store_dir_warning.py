import logging

import backend.session.persistence as persistence


def test_warns_when_session_data_dir_is_unset(monkeypatch, tmp_path, caplog) -> None:
    monkeypatch.delenv("NERDY_SESSION_DATA_DIR", raising=False)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(persistence, "_warned_about_default_store_dir", False, raising=False)

    with caplog.at_level(logging.WARNING, logger="backend.session.persistence"):
        persistence.read_lesson_store()

    messages = [
        record.getMessage()
        for record in caplog.records
        if record.name == "backend.session.persistence" and record.levelno >= logging.WARNING
    ]
    assert any("NERDY_SESSION_DATA_DIR" in message for message in messages)
    assert any(".nerdy-data" in message for message in messages)


def test_default_store_dir_warning_is_emitted_only_once(monkeypatch, tmp_path, caplog) -> None:
    monkeypatch.delenv("NERDY_SESSION_DATA_DIR", raising=False)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(persistence, "_warned_about_default_store_dir", False, raising=False)

    with caplog.at_level(logging.WARNING, logger="backend.session.persistence"):
        persistence.read_lesson_store()
        persistence.read_lesson_store()

    warnings = [
        record
        for record in caplog.records
        if record.name == "backend.session.persistence" and record.levelno >= logging.WARNING
    ]
    assert len(warnings) == 1


def test_no_warning_when_session_data_dir_is_set(monkeypatch, tmp_path, caplog) -> None:
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(persistence, "_warned_about_default_store_dir", False, raising=False)

    with caplog.at_level(logging.WARNING, logger="backend.session.persistence"):
        persistence.read_lesson_store()

    warnings = [
        record
        for record in caplog.records
        if record.name == "backend.session.persistence" and record.levelno >= logging.WARNING
    ]
    assert warnings == []
