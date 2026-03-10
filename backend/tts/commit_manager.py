from __future__ import annotations

from backend.tts.chunk_policy import chunk_text


class CommitManager:
    def __init__(self, mode: str = "sentence") -> None:
        self.mode = mode
        self._buffer = ""
        self._committed_count = 0

    def push_token(self, token: str) -> None:
        self._buffer += token

    def emit_committed_phrase(self) -> str | None:
        chunks = chunk_text(self._buffer, self.mode)
        if self._committed_count >= len(chunks):
            return None
        next_chunk = chunks[self._committed_count]
        self._committed_count += 1
        return next_chunk

    def finish_turn(self) -> list[str]:
        chunks = chunk_text(self._buffer, self.mode)
        remaining = chunks[self._committed_count :]
        self._committed_count = len(chunks)
        return remaining

    def reset(self) -> None:
        self._buffer = ""
        self._committed_count = 0
