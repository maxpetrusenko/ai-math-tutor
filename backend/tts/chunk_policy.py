from __future__ import annotations


def chunk_text(text: str, mode: str) -> list[str]:
    normalized = " ".join(text.split())
    if mode == "sentence":
        chunks = []
        current = ""
        for character in normalized:
            current += character
            if character in ".!?":
                chunks.append(current.strip())
                current = ""
        if current.strip():
            chunks.append(current.strip())
        return chunks

    if mode == "phrase":
        chunks = []
        current = ""
        for character in normalized:
            current += character
            if character in ",!?":
                chunks.append(current.strip())
                current = ""
        if current.strip():
            chunks.append(current.strip())
        return chunks

    raise ValueError(f"unknown chunk mode: {mode}")
