from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import TypedDict, cast


class SessionSnapshot(TypedDict):
    grade_band: str
    history: list[dict[str, str]]
    student_profile: dict[str, str]
    subject: str


class PersistedLessonThread(TypedDict):
    avatarProviderId: str
    conversation: list[dict[str, str]]
    gradeBand: str
    llmModel: str
    llmProvider: str
    preference: str
    sessionId: str
    studentPrompt: str
    subject: str
    ttsModel: str
    ttsProvider: str
    transcript: str
    tutorText: str
    version: int


class PersistedLessonArchiveEntry(TypedDict):
    gradeBand: str
    id: str
    subject: str
    thread: PersistedLessonThread
    title: str
    turnCount: int
    updatedAt: str


class PersistedLessonStore(TypedDict):
    activeThread: PersistedLessonThread | None
    archive: list[PersistedLessonArchiveEntry]
    version: int


class PersistedSessionData(TypedDict):
    lessons: PersistedLessonStore
    snapshots: dict[str, SessionSnapshot]
    version: int


_PERSISTENCE_LOCK = Lock()
_CURRENT_VERSION = 1


def load_session_snapshot(session_id: str) -> SessionSnapshot | None:
    with _PERSISTENCE_LOCK:
        store = _read_store()
        snapshot = store["snapshots"].get(session_id)
        if snapshot is None:
            return None
        return _clone_session_snapshot(snapshot)


def save_session_snapshot(session_id: str, snapshot: SessionSnapshot) -> None:
    with _PERSISTENCE_LOCK:
        store = _read_store()
        store["snapshots"][session_id] = _clone_session_snapshot(snapshot)
        _write_store(store)


def clear_session_snapshot(session_id: str) -> None:
    with _PERSISTENCE_LOCK:
        store = _read_store()
        store["snapshots"].pop(session_id, None)
        _write_store(store)


def read_lesson_store() -> PersistedLessonStore:
    with _PERSISTENCE_LOCK:
        return _clone_lesson_store(_read_store()["lessons"])


def write_active_lesson_thread(thread: PersistedLessonThread) -> PersistedLessonStore:
    with _PERSISTENCE_LOCK:
        store = _read_store()
        store["lessons"]["activeThread"] = _clone_lesson_thread(thread)
        _write_store(store)
        return _clone_lesson_store(store["lessons"])


def clear_active_lesson_thread() -> PersistedLessonStore:
    with _PERSISTENCE_LOCK:
        store = _read_store()
        store["lessons"]["activeThread"] = None
        _write_store(store)
        return _clone_lesson_store(store["lessons"])


def archive_lesson_thread(entry: PersistedLessonArchiveEntry) -> PersistedLessonStore:
    with _PERSISTENCE_LOCK:
        store = _read_store()
        archive = [item for item in store["lessons"]["archive"] if item["id"] != entry["id"]]
        archive.insert(0, _clone_archive_entry(entry))
        store["lessons"]["archive"] = archive[:8]
        _write_store(store)
        return _clone_lesson_store(store["lessons"])


def load_archived_lesson_thread(lesson_id: str) -> PersistedLessonThread | None:
    with _PERSISTENCE_LOCK:
        archive = _read_store()["lessons"]["archive"]
        for entry in archive:
            if entry["id"] == lesson_id:
                return _clone_lesson_thread(entry["thread"])
        return None


def _store_path() -> Path:
    base_dir = Path.cwd() / ".nerdy-data"
    configured = Path((Path.cwd() / ".nerdy-data").as_posix())
    env_value = Path.cwd()
    try:
        from os import getenv

        raw = getenv("NERDY_SESSION_DATA_DIR", "").strip()
        if raw:
            configured = Path(raw).expanduser()
            if not configured.is_absolute():
                configured = (Path.cwd() / configured).resolve()
        else:
            configured = base_dir
    except Exception:
        configured = base_dir

    configured.mkdir(parents=True, exist_ok=True)
    return configured / "session-store.json"


def _empty_store() -> PersistedSessionData:
    return {
        "lessons": {
            "activeThread": None,
            "archive": [],
            "version": 2,
        },
        "snapshots": {},
        "version": _CURRENT_VERSION,
    }


def _read_store() -> PersistedSessionData:
    path = _store_path()
    if not path.exists():
        return _empty_store()

    try:
        payload = json.loads(path.read_text())
    except Exception:
        return _empty_store()

    if not isinstance(payload, dict):
        return _empty_store()

    snapshots = payload.get("snapshots", {})
    lessons = payload.get("lessons", {})
    if not isinstance(snapshots, dict) or not isinstance(lessons, dict):
        return _empty_store()

    return {
        "lessons": {
            "activeThread": _coerce_lesson_thread(lessons.get("activeThread")),
            "archive": _coerce_archive(lessons.get("archive")),
            "version": 2,
        },
        "snapshots": {
            str(session_id): _coerce_session_snapshot(snapshot)
            for session_id, snapshot in snapshots.items()
            if isinstance(session_id, str)
        },
        "version": _CURRENT_VERSION,
    }


def _write_store(store: PersistedSessionData) -> None:
    path = _store_path()
    temp_path = path.with_suffix(".tmp")
    temp_path.write_text(json.dumps(store, indent=2, sort_keys=True))
    temp_path.replace(path)


def _coerce_session_snapshot(value: object) -> SessionSnapshot:
    if not isinstance(value, dict):
        return {"grade_band": "6-8", "history": [], "student_profile": {}, "subject": "general"}

    history = value.get("history", [])
    return {
        "grade_band": str(value.get("grade_band") or "6-8"),
        "history": [
            {
                "content": str(item.get("content", "")),
                "role": str(item.get("role", "")),
            }
            for item in history
            if isinstance(item, dict)
        ],
        "student_profile": {
            str(key): str(item)
            for key, item in cast(dict[object, object], value.get("student_profile", {})).items()
            if item is not None
        }
        if isinstance(value.get("student_profile"), dict)
        else {},
        "subject": str(value.get("subject") or "general"),
    }


def _coerce_lesson_thread(value: object) -> PersistedLessonThread | None:
    if not isinstance(value, dict):
        return None

    conversation = value.get("conversation", [])
    return {
        "avatarProviderId": str(value.get("avatarProviderId") or "human-css-2d"),
        "conversation": [
            {
                "id": str(item.get("id", "")),
                "transcript": str(item.get("transcript", "")),
                "tutorText": str(item.get("tutorText", "")),
            }
            for item in conversation
            if isinstance(item, dict)
        ],
        "gradeBand": str(value.get("gradeBand") or "6-8"),
        "llmModel": str(value.get("llmModel") or "gemini-2.5-flash"),
        "llmProvider": str(value.get("llmProvider") or "gemini"),
        "preference": str(value.get("preference") or ""),
        "sessionId": str(value.get("sessionId") or ""),
        "studentPrompt": str(value.get("studentPrompt") or ""),
        "subject": str(value.get("subject") or "math"),
        "ttsModel": str(value.get("ttsModel") or "sonic-2"),
        "ttsProvider": str(value.get("ttsProvider") or "cartesia"),
        "transcript": str(value.get("transcript") or ""),
        "tutorText": str(value.get("tutorText") or ""),
        "version": int(value.get("version") or 1),
    }


def _coerce_archive(value: object) -> list[PersistedLessonArchiveEntry]:
    if not isinstance(value, list):
        return []

    archive: list[PersistedLessonArchiveEntry] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        thread = _coerce_lesson_thread(item.get("thread"))
        if thread is None:
            continue
        archive.append(
            {
                "gradeBand": str(item.get("gradeBand") or thread["gradeBand"]),
                "id": str(item.get("id") or thread["sessionId"]),
                "subject": str(item.get("subject") or thread["subject"]),
                "thread": thread,
                "title": str(item.get("title") or "Untitled lesson"),
                "turnCount": int(item.get("turnCount") or len(thread["conversation"])),
                "updatedAt": str(item.get("updatedAt") or ""),
            }
        )
    return archive


def _clone_session_snapshot(snapshot: SessionSnapshot) -> SessionSnapshot:
    return {
        "grade_band": snapshot["grade_band"],
        "history": [dict(item) for item in snapshot["history"]],
        "student_profile": dict(snapshot["student_profile"]),
        "subject": snapshot["subject"],
    }


def _clone_lesson_thread(thread: PersistedLessonThread) -> PersistedLessonThread:
    return {
        "avatarProviderId": thread["avatarProviderId"],
        "conversation": [dict(item) for item in thread["conversation"]],
        "gradeBand": thread["gradeBand"],
        "llmModel": thread["llmModel"],
        "llmProvider": thread["llmProvider"],
        "preference": thread["preference"],
        "sessionId": thread["sessionId"],
        "studentPrompt": thread["studentPrompt"],
        "subject": thread["subject"],
        "ttsModel": thread["ttsModel"],
        "ttsProvider": thread["ttsProvider"],
        "transcript": thread["transcript"],
        "tutorText": thread["tutorText"],
        "version": thread["version"],
    }


def _clone_archive_entry(entry: PersistedLessonArchiveEntry) -> PersistedLessonArchiveEntry:
    return {
        "gradeBand": entry["gradeBand"],
        "id": entry["id"],
        "subject": entry["subject"],
        "thread": _clone_lesson_thread(entry["thread"]),
        "title": entry["title"],
        "turnCount": entry["turnCount"],
        "updatedAt": entry["updatedAt"],
    }


def _clone_lesson_store(store: PersistedLessonStore) -> PersistedLessonStore:
    return {
        "activeThread": _clone_lesson_thread(store["activeThread"]) if store["activeThread"] is not None else None,
        "archive": [_clone_archive_entry(entry) for entry in store["archive"]],
        "version": store["version"],
    }
