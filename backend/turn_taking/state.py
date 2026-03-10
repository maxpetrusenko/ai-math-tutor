from __future__ import annotations

from enum import StrEnum


class SessionState(StrEnum):
    IDLE = "idle"
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"
    FADING = "fading"
    FAILED = "failed"
