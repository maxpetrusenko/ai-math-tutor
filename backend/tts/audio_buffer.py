from __future__ import annotations


class AudioBuffer:
    def __init__(self) -> None:
        self._chunks: list[bytes] = []

    def push(self, chunk: bytes) -> None:
        self._chunks.append(chunk)

    def drain(self) -> list[bytes]:
        drained = list(self._chunks)
        self._chunks.clear()
        return drained

    def reset(self) -> None:
        self._chunks.clear()
