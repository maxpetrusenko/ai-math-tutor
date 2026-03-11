from __future__ import annotations

import re


def build_draft_tutor_reply(
    subject: str,
    grade_band: str,
    latest_student_text: str,
    student_profile: dict[str, str] | None = None,
    history: list[dict[str, str]] | None = None,
) -> str:
    lowered = latest_student_text.strip().lower()
    profile_text = " ".join(value.lower() for value in (student_profile or {}).values())
    wants_slow = "slow" in profile_text
    wants_concrete = "concrete" in profile_text or "example" in profile_text
    prior_turns = history or []

    if subject == "math":
        follow_up_reply = _math_follow_up_reply(lowered, prior_turns)
        if follow_up_reply:
            return follow_up_reply
        arithmetic_reply = _math_expression_reply(lowered)
        if arithmetic_reply:
            return arithmetic_reply
        if _looks_like_truth_check(lowered):
            prefix = "Let's slow it down. " if wants_slow else "Nice start. "
            question = _math_truth_check_question(lowered, wants_concrete=wants_concrete)
            return f"{prefix}{question}"
        equation_reply = _math_equation_reply(latest_student_text.strip())
        if equation_reply:
            return equation_reply
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


def _math_follow_up_reply(text: str, history: list[dict[str, str]]) -> str | None:
    if not history:
        return None

    previous_student = _latest_history_content(history, "user")
    if not previous_student:
        return None

    arithmetic_follow_up = _math_arithmetic_follow_up_reply(text, previous_student)
    if arithmetic_follow_up:
        return arithmetic_follow_up

    equation_follow_up = _math_equation_follow_up_reply(text, previous_student)
    if equation_follow_up:
        return equation_follow_up

    if _looks_like_short_answer(text):
        return f"You might be onto something. How can you verify {text}?"
    return None


def _math_arithmetic_follow_up_reply(text: str, previous_student: str) -> str | None:
    if not _looks_like_short_answer(text):
        return None

    expression_match = re.search(r"(\d+)\s*([+\-*/])\s*(\d+)", previous_student)
    if not expression_match:
        return None

    left, operator, right = expression_match.groups()
    expected = _evaluate_simple_expression(int(left), operator, int(right))
    if expected is None:
        return f"Try checking {previous_student.strip()} one step at a time. What result do you get?"

    expected_text = _format_number(expected)
    expression = f"{left}{operator}{right}"
    if _matches_numeric_answer(text, expected):
        return f"That's right; {expression} gives {expected_text}. How did you get {expected_text}?"
    return f"Check {expression} again. What total do you get when you add {left} and {right}?"


def _math_equation_follow_up_reply(text: str, previous_student: str) -> str | None:
    if not _looks_like_equation_step(text):
        return None

    step = _expected_equation_first_step(previous_student)
    if step is None:
        return None

    verb, value = step
    compact_text = " ".join(text.split())
    equation = previous_student.strip()
    if verb in compact_text and value in compact_text:
        return (
            f"That's right; for {equation} {verb} {value} from both sides first. "
            "What equation do you get next?"
        )

    return (
        f"For {equation}, the number next to x is changed by {value}. "
        f"What inverse step moves it away first?"
    )


def _looks_like_short_answer(text: str) -> bool:
    return bool(re.fullmatch(r"[-+]?\d+(?:\.\d+)?", text)) or text in {"yes", "no", "maybe"}


def _latest_history_content(history: list[dict[str, str]], role: str) -> str:
    for item in reversed(history):
        if item.get("role") == role:
            return item.get("content", "")
    return ""


def _evaluate_simple_expression(left: int, operator: str, right: int) -> float | None:
    if operator == "+":
        return float(left + right)
    if operator == "-":
        return float(left - right)
    if operator == "*":
        return float(left * right)
    if operator == "/" and right != 0:
        return left / right
    return None


def _matches_numeric_answer(text: str, expected: float) -> bool:
    try:
        return abs(float(text) - expected) < 0.0001
    except ValueError:
        return False


def _format_number(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return str(round(value, 2))


def _math_expression_reply(text: str) -> str | None:
    match = re.fullmatch(r"(\d+)\s*([+\-*/])\s*(\d+)", text)
    if not match:
        return None

    left, operator, right = match.groups()
    expression = f"{left}{operator}{right}"
    operator_word = {
        "+": "add",
        "-": "subtract",
        "*": "multiply",
        "/": "divide",
    }[operator]
    if operator == "+":
        return f"Let's work on {expression}. What total do you get when you add {left} and {right}?"
    if operator == "-":
        return f"Let's work on {expression}. What do you get when you subtract {right} from {left}?"
    if operator == "*":
        return f"Let's work on {expression}. What product do you get when you {operator_word} {left} and {right}?"
    return f"Let's work on {expression}. What quotient do you get when you divide {left} by {right}?"


def _math_equation_reply(text: str) -> str | None:
    step = _expected_equation_first_step(text)
    if step is None:
        return None

    verb, value = step
    equation = " ".join(text.split())
    return f"For {equation}, what should you {verb} from both sides first?"


def _looks_like_equation_step(text: str) -> bool:
    return bool(re.fullmatch(r"(add|subtract|multiply|divide)\s+\d+(?:\.\d+)?", text))


def _expected_equation_first_step(text: str) -> tuple[str, str] | None:
    compact = re.sub(r"\s+", "", text.lower())
    match = re.search(r"x([+-])(\d+(?:\.\d+)?)=", compact)
    if not match:
        return None

    operator, value = match.groups()
    if operator == "+":
        return ("subtract", value)
    return ("add", value)
