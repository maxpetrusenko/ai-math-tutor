from __future__ import annotations

import re


def build_draft_tutor_reply(
    subject: str,
    grade_band: str,
    latest_student_text: str,
    student_profile: dict[str, str] | None = None,
) -> str:
    lowered = latest_student_text.strip().lower()
    profile_text = " ".join(value.lower() for value in (student_profile or {}).values())
    wants_slow = "slow" in profile_text
    wants_concrete = "concrete" in profile_text or "example" in profile_text

    if subject == "math":
        if _looks_like_truth_check(lowered):
            prefix = "Let's slow it down. " if wants_slow else "Nice start. "
            question = _math_truth_check_question(lowered, wants_concrete=wants_concrete)
            return f"{prefix}{question}"
        if "solve for x" in lowered or ("x" in lowered and "equation" in lowered):
            return "Nice start. What number or operation is attached to x in the equation?"
        if "x" in lowered:
            return "Nice start. What is happening to x, and which side should you work on first?"
        return "Nice start. What part can you check first?"

    if subject == "science":
        if "photosynthesis" in lowered or "plant" in lowered:
            return "Good question. What do plants use from light to start making food?"
        return "Good question. What do you already know, and what should we test first?"

    if subject == "english":
        if grade_band == "11-12":
            return "Good try. Can you identify the subject and the verb that need to agree?"
        return "Good try. Which subject and verb should you compare first?"

    return "Nice start. What is one clue you can use to test that idea?"


def _looks_like_truth_check(text: str) -> bool:
    return "is it true" in text or bool(re.search(r"\d+\s*[-+*/]\s*\d+\s*=\s*\d+", text))


def _math_truth_check_question(text: str, *, wants_concrete: bool) -> str:
    addition_match = re.search(r"(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)", text)
    if addition_match and wants_concrete:
        left, right, _ = addition_match.groups()
        return f"If you put {left} blocks with {right} more blocks, how many blocks do you count?"
    if addition_match:
        left, right, _ = addition_match.groups()
        return f"What total do you get when you add {left} and {right}?"
    return "How could you test that with a small example?"
