from __future__ import annotations

from backend.monitoring.latency_tracker import LatencyTracker


class MiniMaxSpeechClient:
    provider_name = "minimax"

    def start_context(self, turn_id: str, voice_config: dict[str, str] | None = None) -> dict[str, object]:
        return {
            "type": "tts.context.started",
            "provider": self.provider_name,
            "turn_id": turn_id,
            "voice_config": voice_config or {},
        }

    def send_phrase(
        self,
        text: str,
        tracker: LatencyTracker,
        first_audio_ts_ms: float,
        is_final: bool = False,
    ) -> dict[str, object]:
        tracker.mark("tts_first_audio", first_audio_ts_ms, {"provider": self.provider_name})
        words = text.split()
        timestamps = [
            {"word": word, "start_ms": index * 110, "end_ms": index * 110 + 90}
            for index, word in enumerate(words)
        ]
        return {
            "type": "tts.audio",
            "provider": self.provider_name,
            "audio": text,
            "is_final": is_final,
            "timestamps": timestamps,
        }

    def flush(self) -> dict[str, object]:
        return {"type": "tts.flush", "provider": self.provider_name}

    def cancel(self) -> dict[str, object]:
        return {"type": "tts.cancel", "provider": self.provider_name}
