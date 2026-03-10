from __future__ import annotations


def build_tutor_messages(
    subject: str,
    grade_band: str,
    latest_student_text: str,
    history: list[dict[str, str]],
    student_profile: dict[str, str] | None = None,
) -> list[dict[str, str]]:
    profile_bits = []
    for key, value in (student_profile or {}).items():
        profile_bits.append(f"{key}: {value}")

    system_prompt = (
        "You are a live AI tutor for grades "
        f"{grade_band}. Subject: {subject}. "
        "Keep answers short, spoken-first, and Socratic. "
        "End most turns with a forward-moving question."
    )
    if profile_bits:
        system_prompt = f"{system_prompt} Student profile: {'; '.join(profile_bits)}."
    return [{"role": "system", "content": system_prompt}, *history, {"role": "user", "content": latest_student_text}]
