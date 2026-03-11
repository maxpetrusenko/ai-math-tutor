from __future__ import annotations

import re


def filter_history_for_latest_turn(
    *,
    subject: str,
    latest_student_text: str,
    history: list[dict[str, str]],
) -> list[dict[str, str]]:
    if not history:
        return history

    normalized_subject = subject.strip().lower()
    normalized_text = latest_student_text.strip().lower()
    if not normalized_text:
        return history

    latest_topic = None if _looks_like_dependent_follow_up(normalized_text) else _infer_topic(normalized_subject, normalized_text)
    active_topic = latest_topic or _latest_specific_student_topic(normalized_subject, history)
    if active_topic is None:
        return history

    cutoff = len(history)
    seen_active_topic = latest_topic is not None

    for index in range(len(history) - 1, -1, -1):
        item = history[index]
        if item.get("role") != "user":
            continue
        topic = _infer_topic(normalized_subject, item.get("content", "").strip().lower())
        if topic is None:
            continue
        if topic == active_topic:
            seen_active_topic = True
            cutoff = index
            continue
        if seen_active_topic:
            return history[cutoff:]

    if cutoff == len(history):
        if latest_topic is not None:
            return []
        return history
    return history[cutoff:]


def _looks_like_dependent_follow_up(text: str) -> bool:
    if re.fullmatch(r"[-+]?\d+(?:\.\d+)?", text):
        return True

    if re.fullmatch(r"(add|subtract|multiply|divide)\s+\d+(?:\.\d+)?(?:\s+(?:to|from|by|on))?(?:\s+both\s+sides)?", text):
        return True

    return text in {
        "yes",
        "no",
        "maybe",
        "i think so",
        "not sure",
        "show me",
        "why",
        "how",
    }


def _infer_topic(subject: str, text: str) -> str | None:
    if subject == "math":
        equation = _extract_equation(text)
        if equation is not None:
            return f"algebra-equation:{equation}"
        expression = _extract_expression(text)
        if expression is not None:
            return f"arithmetic-expression:{expression}"
        if "solve for x" in text or "equation" in text or re.search(r"\bx\b", text):
            return "algebra-equation:general"
        return None

    if subject == "science":
        if "photosynthesis" in text or "plant" in text or "light" in text:
            return "photosynthesis"
        return None

    if subject == "english":
        if "subject" in text or "verb" in text or "sentence" in text:
            return "grammar"
        return None

    return None


def _latest_specific_student_topic(subject: str, history: list[dict[str, str]]) -> str | None:
    for item in reversed(history):
        if item.get("role") != "user":
            continue
        topic = _infer_topic(subject, item.get("content", "").strip().lower())
        if topic is not None:
            return topic
    return None


def _extract_expression(text: str) -> str | None:
    match = re.search(r"(\d+)\s*([+\-*/])\s*(\d+)", text)
    if not match:
        return None
    left, operator, right = match.groups()
    return f"{left}{operator}{right}"


def _extract_equation(text: str) -> str | None:
    if "=" not in text or "x" not in text:
        return None
    return re.sub(r"\s+", "", text)
