from __future__ import annotations

import logging

from backend.ai.call_logging import run_logged_ai_call
from backend.monitoring.latency_tracker import LatencyTracker

logger = logging.getLogger(__name__)


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
        options: dict[str, str] | None = None,
    ) -> dict[str, object]:
        model = (options or {}).get("model", "minimax-speech")

        def _build_response() -> dict[str, object]:
            tracker.mark(
                "tts_first_audio",
                first_audio_ts_ms,
                {"provider": self.provider_name, "model": model},
            )
            words = text.split()
            timestamps = [
                {"word": word, "start_ms": index * 110, "end_ms": index * 110 + 90}
                for index, word in enumerate(words)
            ]
            return {
                "type": "tts.audio",
                "provider": self.provider_name,
                "model": model,
                "audio": text,
                "is_final": is_final,
                "timestamps": timestamps,
            }

        return run_logged_ai_call(
            logger=logger,
            provider=self.provider_name,
            operation="tts.send_phrase",
            request_payload={"model": model, "text": text, "is_final": is_final, "mode": "stub"},
            call=_build_response,
            response_summarizer=lambda event: {
                "type": str(event.get("type") or ""),
                "provider": str(event.get("provider") or ""),
                "model": str(event.get("model") or ""),
                "is_final": bool(event.get("is_final")),
                "timestamps": len(event.get("timestamps", [])) if isinstance(event.get("timestamps"), list) else 0,
            },
        )

    def flush(self) -> dict[str, object]:
        return {"type": "tts.flush", "provider": self.provider_name}

    def cancel(self) -> dict[str, object]:
        return {"type": "tts.cancel", "provider": self.provider_name}
