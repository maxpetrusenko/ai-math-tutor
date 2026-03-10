from __future__ import annotations


class TranscriptCommitter:
    def __init__(self, stability_repeats: int = 2) -> None:
        self.stability_repeats = stability_repeats
        self._last_partial = ""
        self._repeat_count = 0
        self.last_committed_text = ""

    def push_partial(self, text: str) -> str | None:
        normalized = text.strip()
        if not normalized:
            return None

        if normalized == self._last_partial:
            self._repeat_count += 1
        else:
            self._last_partial = normalized
            self._repeat_count = 1

        if self._repeat_count >= self.stability_repeats and normalized != self.last_committed_text:
            self.last_committed_text = normalized
            return normalized
        return None

    def push_final(self, text: str) -> str:
        normalized = text.strip()
        self._last_partial = normalized
        self._repeat_count = self.stability_repeats
        self.last_committed_text = normalized
        return normalized
