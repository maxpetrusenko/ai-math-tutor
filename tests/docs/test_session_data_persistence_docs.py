from pathlib import Path


def test_session_data_persistence_doc_covers_hosted_contract() -> None:
    doc = Path("docs/session-data-persistence.md").read_text()

    assert "NERDY_SESSION_DATA_DIR" in doc
    assert "/app/.nerdy-data" in doc
    assert "session-store.json" in doc
    assert "ai-math-tutor-session" in doc
    assert "ai-math-tutor-backend" in doc
    assert "Persistent Storage" in doc
    assert "docker inspect" in doc
    assert "container recreation" in doc


def test_architecture_doc_links_session_data_persistence() -> None:
    architecture = Path("docs/ARCHITECTURE.md").read_text()

    assert "session-data-persistence.md" in architecture


def test_env_example_documents_session_data_dir() -> None:
    env_example = Path(".env.example").read_text()

    assert "NERDY_SESSION_DATA_DIR" in env_example


def test_readme_links_session_data_persistence() -> None:
    readme = Path("README.md").read_text()

    assert "session-data-persistence.md" in readme
