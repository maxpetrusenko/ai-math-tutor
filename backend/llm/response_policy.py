from __future__ import annotations


def shape_tutor_response(text: str, max_sentences: int = 2) -> str:
    normalized = " ".join(text.strip().split())
    sentences = [part.strip() for part in normalized.replace("?", ".").split(".") if part.strip()]
    kept = ". ".join(sentences[:max_sentences]).strip()

    lowered = kept.lower()
    if "the answer is" in lowered:
        kept = "What step could you try next"

    if not kept.endswith("?"):
        kept = kept.rstrip(".") + "?"

    return kept
