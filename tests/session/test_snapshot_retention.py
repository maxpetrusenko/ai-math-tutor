"""Snapshot-store retention: the snapshots map must stay bounded.

Every snapshot save rewrites the whole session-store.json, and snapshots are
only removed on an explicit ``session.reset``.  Without a retention bound the
map -- and therefore the store file and the per-turn write cost -- grows for
the lifetime of the deployment.  These tests pin the retention contract:
least-recently-written snapshots are evicted beyond the limit, recency
survives store round-trips, and eviction is per namespace.
"""

import json
import time

from backend.session import persistence
from backend.session.persistence import (
    SessionSnapshot,
    clear_archived_lesson_threads,
    load_session_snapshot,
    save_session_snapshot,
)


def _snapshot(tag: str) -> SessionSnapshot:
    return {
        "grade_band": "6-8",
        "history": [
            {"role": "user", "content": f"question {tag}"},
            {"role": "assistant", "content": f"answer {tag}"},
        ],
        "student_profile": {"name": "Sam"},
        "subject": "math",
    }


def _stored_snapshot_ids(tmp_path) -> list[str]:
    store = json.loads((tmp_path / "session-store.json").read_text())
    return list(store["namespaces"]["default"]["snapshots"].keys())


def test_retention_limit_is_defined() -> None:
    assert persistence.SESSION_SNAPSHOT_RETENTION_LIMIT >= 1


def test_snapshot_store_evicts_oldest_sessions_beyond_retention_limit(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(persistence, "SESSION_SNAPSHOT_RETENTION_LIMIT", 3)

    for index in range(5):
        save_session_snapshot(f"session-{index}", _snapshot(f"tag-{index}"))
        time.sleep(0.01)

    assert sorted(_stored_snapshot_ids(tmp_path)) == ["session-2", "session-3", "session-4"]
    assert load_session_snapshot("session-0") is None
    assert load_session_snapshot("session-1") is None
    assert load_session_snapshot("session-4") == _snapshot("tag-4")
    assert load_session_snapshot("session-2") == _snapshot("tag-2")


def test_retention_limit_boundary_does_not_evict(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(persistence, "SESSION_SNAPSHOT_RETENTION_LIMIT", 3)

    for index in range(3):
        save_session_snapshot(f"session-{index}", _snapshot(f"tag-{index}"))
        time.sleep(0.01)

    assert sorted(_stored_snapshot_ids(tmp_path)) == ["session-0", "session-1", "session-2"]


def test_resaving_existing_snapshot_refreshes_its_recency(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(persistence, "SESSION_SNAPSHOT_RETENTION_LIMIT", 3)

    save_session_snapshot("session-a", _snapshot("a-first"))
    time.sleep(0.01)
    save_session_snapshot("session-b", _snapshot("b"))
    time.sleep(0.01)
    save_session_snapshot("session-c", _snapshot("c"))
    time.sleep(0.01)
    save_session_snapshot("session-a", _snapshot("a-updated"))
    time.sleep(0.01)
    save_session_snapshot("session-d", _snapshot("d"))

    assert sorted(_stored_snapshot_ids(tmp_path)) == ["session-a", "session-c", "session-d"]
    assert load_session_snapshot("session-b") is None
    assert load_session_snapshot("session-a") == _snapshot("a-updated")


def test_snapshot_recency_survives_store_read_write_roundtrip(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(persistence, "SESSION_SNAPSHOT_RETENTION_LIMIT", 2)

    # Alphabetical order disagrees with recency on purpose: if recency metadata
    # were dropped when coercing a stored snapshot, "alpha" would look equally
    # old as "bravo" and the deterministic tie-break would evict "alpha".
    save_session_snapshot("session-bravo", _snapshot("bravo"))
    time.sleep(0.01)
    save_session_snapshot("session-alpha", _snapshot("alpha"))

    # Force an unrelated read-coerce-write cycle over the same store.
    clear_archived_lesson_threads()
    time.sleep(0.01)

    save_session_snapshot("session-charlie", _snapshot("charlie"))

    assert sorted(_stored_snapshot_ids(tmp_path)) == ["session-alpha", "session-charlie"]
    assert load_session_snapshot("session-bravo") is None


def test_retention_applies_per_namespace(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(persistence, "SESSION_SNAPSHOT_RETENTION_LIMIT", 2)

    for index in range(3):
        save_session_snapshot(f"alpha-{index}", _snapshot(f"alpha-{index}"), namespace="alpha-ns")
        time.sleep(0.01)
    for index in range(3):
        save_session_snapshot(f"beta-{index}", _snapshot(f"beta-{index}"), namespace="beta-ns")
        time.sleep(0.01)

    store = json.loads((tmp_path / "session-store.json").read_text())
    alpha_ids = sorted(store["namespaces"]["alpha-ns"]["snapshots"].keys())
    beta_ids = sorted(store["namespaces"]["beta-ns"]["snapshots"].keys())
    assert alpha_ids == ["alpha-1", "alpha-2"]
    assert beta_ids == ["beta-1", "beta-2"]


def test_legacy_store_without_recency_metadata_is_trimmed_deterministically(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(persistence, "SESSION_SNAPSHOT_RETENTION_LIMIT", 2)

    legacy_snapshot = {
        "grade_band": "6-8",
        "history": [],
        "student_profile": {},
        "subject": "math",
    }
    (tmp_path / "session-store.json").write_text(
        json.dumps(
            {
                "namespaces": {
                    "default": {
                        "lessons": {"activeThread": None, "archive": [], "version": 2},
                        "snapshots": {
                            legacy_id: dict(legacy_snapshot)
                            for legacy_id in ("alpha", "bravo", "charlie", "delta")
                        },
                    }
                },
                "version": 2,
            }
        )
    )

    save_session_snapshot("zeta", _snapshot("zeta"))

    assert sorted(_stored_snapshot_ids(tmp_path)) == ["delta", "zeta"]


def test_non_finite_recency_values_are_treated_as_oldest(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("NERDY_SESSION_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(persistence, "SESSION_SNAPSHOT_RETENTION_LIMIT", 1)

    (tmp_path / "session-store.json").write_text(
        json.dumps(
            {
                "namespaces": {
                    "default": {
                        "lessons": {"activeThread": None, "archive": [], "version": 2},
                        "snapshots": {
                            "pinned": {
                                "grade_band": "6-8",
                                "history": [],
                                "student_profile": {},
                                "subject": "math",
                                "updatedAt": float("inf"),
                            }
                        },
                    }
                },
                "version": 2,
            }
        )
    )

    save_session_snapshot("fresh", _snapshot("fresh"))

    assert sorted(_stored_snapshot_ids(tmp_path)) == ["fresh"]
    assert load_session_snapshot("fresh") == _snapshot("fresh")
