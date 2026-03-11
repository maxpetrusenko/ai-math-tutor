from __future__ import annotations

import re


_DIRECT_ANSWER_MARKERS = ("the answer is", "it's ", "it is ", "x = ", "equals ")
_GENERIC_FILLER_MARKERS = (
    "you're definitely focused on that",
    "you're focused on that",
    "great question",
)


def shape_tutor_response(text: str, max_sentences: int = 2) -> str:
    normalized = " ".join(text.strip().split())
    if not normalized:
        return "What should you try next?"

    lowered = normalized.lower()
    if any(marker in lowered for marker in _DIRECT_ANSWER_MARKERS):
        return "What step could you try next?"

    sentences = _split_sentences(normalized)
    if len(sentences) > 1:
        sentences = [
            sentence
            for sentence in sentences
            if sentence.lower().rstrip("!?.,") not in _GENERIC_FILLER_MARKERS
        ] or sentences

    kept = " ".join(_select_sentence_window(sentences, max_sentences=max_sentences)).strip()
    if not kept:
        kept = normalized

    if "?" not in kept:
        kept = kept.rstrip(".!") + "?"

    return kept


def _split_sentences(text: str) -> list[str]:
    return [match.group(0).strip() for match in re.finditer(r"[^.!?]+[.!?]?", text) if match.group(0).strip()]


def _select_sentence_window(sentences: list[str], *, max_sentences: int) -> list[str]:
    if len(sentences) <= max_sentences:
        return sentences

    question_index = None
    for index in range(len(sentences) - 1, -1, -1):
        if sentences[index].endswith("?"):
            question_index = index
            break

    if question_index is not None:
        start = max(0, question_index - max_sentences + 1)
        return sentences[start : question_index + 1]

    return sentences[-max_sentences:]
