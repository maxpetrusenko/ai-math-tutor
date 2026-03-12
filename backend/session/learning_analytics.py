from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TypedDict

from backend.session.persistence import PersistedLessonArchiveEntry, PersistedLessonThread


class LearningAnalyticsAchievement(TypedDict):
    detail: str
    id: str
    label: str


class LearningAnalyticsSummary(TypedDict):
    achievements: list[LearningAnalyticsAchievement]
    completedLessons: int
    currentStreakDays: int
    estimatedMinutes: int
    masteryScore: int
    practiceDays: int
    recentLessonTitles: list[str]
    strongestSubject: str
    tutorTurns: int


def summarize_learning_analytics(
    *,
    active_thread: PersistedLessonThread | None,
    archived_lessons: list[PersistedLessonArchiveEntry],
    now_iso: str | None = None,
) -> LearningAnalyticsSummary:
    now = _parse_datetime(now_iso) if now_iso else datetime.now(UTC)
    practice_day_keys = _build_practice_day_keys(active_thread, archived_lessons, now)
    archived_turns = sum(entry["turnCount"] for entry in archived_lessons)
    active_turns = len(active_thread["conversation"]) if active_thread else 0
    estimated_minutes = (archived_turns * 3) + (active_turns * 3)
    mastery_inputs = [_estimate_archived_lesson_mastery(entry) for entry in archived_lessons]
    active_mastery = _estimate_active_lesson_mastery(active_thread)
    if active_mastery is not None:
        mastery_inputs.append(active_mastery)
    mastery_score = round(sum(mastery_inputs) / len(mastery_inputs)) if mastery_inputs else 0
    strongest_subject = _resolve_strongest_subject(active_thread, archived_lessons)
    completed_lessons = len(archived_lessons)
    current_streak_days = _compute_current_streak(practice_day_keys, now)

    return {
        "achievements": _build_achievements(
            completed_lessons=completed_lessons,
            current_streak_days=current_streak_days,
            estimated_minutes=estimated_minutes,
            mastery_score=mastery_score,
        ),
        "completedLessons": completed_lessons,
        "currentStreakDays": current_streak_days,
        "estimatedMinutes": estimated_minutes,
        "masteryScore": mastery_score,
        "practiceDays": len(practice_day_keys),
        "recentLessonTitles": [
            entry["title"]
            for entry in sorted(archived_lessons, key=_archived_sort_key, reverse=True)[:3]
        ],
        "strongestSubject": strongest_subject,
        "tutorTurns": archived_turns + active_turns,
    }


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if normalized.endswith("Z"):
        normalized = f"{normalized[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def _to_day_key(value: str) -> str | None:
    parsed = _parse_datetime(value)
    return parsed.astimezone(UTC).date().isoformat() if parsed else None


def _day_key_to_utc(day_key: str) -> datetime:
    return datetime.fromisoformat(f"{day_key}T00:00:00+00:00")


def _build_practice_day_keys(
    active_thread: PersistedLessonThread | None,
    archived_lessons: list[PersistedLessonArchiveEntry],
    now: datetime,
) -> list[str]:
    day_keys: set[str] = set()

    if active_thread:
        day_keys.add(now.astimezone(UTC).date().isoformat())

    for lesson in archived_lessons:
        day_key = _to_day_key(lesson["updatedAt"])
        if day_key:
            day_keys.add(day_key)

    return sorted(day_keys, key=_day_key_to_utc, reverse=True)


def _compute_current_streak(day_keys: list[str], now: datetime) -> int:
    if not day_keys:
        return 0

    today_key = now.astimezone(UTC).date().isoformat()
    yesterday_key = (now.astimezone(UTC) - timedelta(days=1)).date().isoformat()
    if day_keys[0] not in {today_key, yesterday_key}:
        return 0

    streak = 1
    for index in range(1, len(day_keys)):
        current_day = _day_key_to_utc(day_keys[index - 1])
        next_day = _day_key_to_utc(day_keys[index])
        if (current_day - next_day).days != 1:
            break
        streak += 1

    return streak


def _estimate_archived_lesson_mastery(entry: PersistedLessonArchiveEntry) -> int:
    lesson_state = entry["thread"].get("lessonState")
    if lesson_state and lesson_state.get("program"):
        program = lesson_state["program"]
        return round(((lesson_state.get("currentStepIndex", 0) + 1) / len(program)) * 100)
    return min(90, 45 + (entry["turnCount"] * 15))


def _estimate_active_lesson_mastery(active_thread: PersistedLessonThread | None) -> int | None:
    lesson_state = active_thread.get("lessonState") if active_thread else None
    if not lesson_state or not lesson_state.get("program"):
        return None
    return round(((lesson_state.get("currentStepIndex", 0) + 1) / len(lesson_state["program"])) * 100)


def _format_subject_label(subject: str) -> str:
    return f"{subject[:1].upper()}{subject[1:]}" if subject else "Math"


def _resolve_strongest_subject(
    active_thread: PersistedLessonThread | None,
    archived_lessons: list[PersistedLessonArchiveEntry],
) -> str:
    subject_counts: dict[str, int] = {}

    def increment(subject: str | None) -> None:
        normalized = (subject or "").strip()
        if not normalized:
            return
        subject_counts[normalized] = subject_counts.get(normalized, 0) + 1

    if active_thread:
        increment(active_thread["subject"])
    for lesson in archived_lessons:
        increment(lesson["subject"])

    if not subject_counts:
        return "Math"

    strongest_subject = sorted(subject_counts.items(), key=lambda item: (-item[1], item[0]))[0][0]
    return _format_subject_label(strongest_subject)


def _build_achievements(
    *,
    completed_lessons: int,
    current_streak_days: int,
    estimated_minutes: int,
    mastery_score: int,
) -> list[LearningAnalyticsAchievement]:
    achievements: list[LearningAnalyticsAchievement] = []

    if current_streak_days >= 2:
        achievements.append(
            {
                "detail": f"Practiced {current_streak_days} days in a row",
                "id": "streak",
                "label": f"{current_streak_days}-day streak",
            }
        )

    if completed_lessons >= 2:
        achievements.append(
            {
                "detail": f"Wrapped {completed_lessons} saved lessons",
                "id": "lesson-finisher",
                "label": "Lesson finisher",
            }
        )

    if mastery_score >= 70:
        achievements.append(
            {
                "detail": "Built strong completion across recent lesson steps",
                "id": "mastery",
                "label": "Mastery climbing",
            }
        )

    if estimated_minutes >= 15:
        achievements.append(
            {
                "detail": f"{estimated_minutes} guided minutes banked this cycle",
                "id": "deep-practice",
                "label": "Deep practice",
            }
        )

    return achievements


def _archived_sort_key(entry: PersistedLessonArchiveEntry) -> tuple[datetime, str]:
    parsed = _parse_datetime(entry["updatedAt"]) or datetime.fromtimestamp(0, UTC)
    return parsed.astimezone(UTC), entry["title"]
