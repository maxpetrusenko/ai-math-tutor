from __future__ import annotations

import base64
import json
import os
import struct
import time
from urllib import request

from backend.benchmarks.run_latency_benchmark import load_local_env
from backend.monitoring.latency_tracker import LatencyTracker

CARTESIA_BYTES_URL = "https://api.cartesia.ai/tts/bytes"
CARTESIA_VERSION = "2025-04-16"
DEFAULT_CARTESIA_MODEL = "sonic-2"
DEFAULT_CARTESIA_VOICE_ID = "694f9389-aac1-45b6-b726-9d9369183238"
DEFAULT_CARTESIA_LANGUAGE = "en"
DEFAULT_CARTESIA_SAMPLE_RATE = 22050


class CartesiaClient:
    provider_name = "cartesia"

    def __init__(self) -> None:
        self._voice_config: dict[str, str] = {}

    def start_context(self, turn_id: str, voice_config: dict[str, str] | None = None) -> dict[str, object]:
        self._voice_config = voice_config or {}
        return {
            "type": "tts.context.started",
            "provider": self.provider_name,
            "turn_id": turn_id,
            "voice_config": self._voice_config,
        }

    def send_phrase(
        self,
        text: str,
        tracker: LatencyTracker,
        first_audio_ts_ms: float,
        is_final: bool = False,
        options: dict[str, str] | None = None,
    ) -> dict[str, object]:
        live_api_key = self._resolve_api_key()
        model = (options or {}).get("model") or os.getenv("NERDY_RUNTIME_TTS_MODEL", DEFAULT_CARTESIA_MODEL)
        if live_api_key:
            try:
                audio_bytes, first_audio_delta_ms, audio_duration_ms = self._synthesize_live(
                    text=text,
                    api_key=live_api_key,
                    model=model,
                )
                tracker.mark(
                    "tts_first_audio",
                    round(first_audio_ts_ms + first_audio_delta_ms, 1),
                    {
                        "provider": self.provider_name,
                        "mode": "live",
                        "model": model,
                    },
                )
                return {
                    "type": "tts.audio",
                    "provider": self.provider_name,
                    "model": model,
                    "audio_b64": base64.b64encode(audio_bytes).decode("ascii"),
                    "audio_mime_type": "audio/wav",
                    "is_final": is_final,
                    "timestamps": _build_word_timestamps(text, audio_duration_ms),
                }
            except Exception:
                pass

        tracker.mark("tts_first_audio", first_audio_ts_ms, {"provider": self.provider_name, "mode": "stub", "model": model})
        words = text.split()
        timestamps = [
            {"word": word, "start_ms": index * 120, "end_ms": index * 120 + 100}
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

    def flush(self) -> dict[str, object]:
        return {"type": "tts.flush", "provider": self.provider_name}

    def cancel(self) -> dict[str, object]:
        return {"type": "tts.cancel", "provider": self.provider_name}

    def _resolve_api_key(self) -> str:
        if os.getenv("NERDY_DISABLE_LIVE_TTS", "").strip() == "1":
            return ""
        load_local_env()
        return os.getenv("CARTESIA_API_KEY", "").strip()

    def _synthesize_live(self, *, text: str, api_key: str, model: str) -> tuple[bytes, float, float]:
        started_at = time.perf_counter()
        response = request.urlopen(
            request.Request(
                CARTESIA_BYTES_URL,
                data=json.dumps(
                    {
                        "model_id": model,
                        "transcript": text,
                        "voice": {
                            "mode": "id",
                            "id": self._voice_config.get("voice_id")
                            or os.getenv("NERDY_TTS_VOICE_CARTESIA", DEFAULT_CARTESIA_VOICE_ID),
                        },
                        "language": os.getenv("NERDY_RUNTIME_TTS_LANGUAGE", DEFAULT_CARTESIA_LANGUAGE),
                        "output_format": {
                            "container": "wav",
                            "encoding": "pcm_s16le",
                            "sample_rate": int(
                                os.getenv("NERDY_RUNTIME_TTS_SAMPLE_RATE", str(DEFAULT_CARTESIA_SAMPLE_RATE))
                            ),
                        },
                    }
                ).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Cartesia-Version": CARTESIA_VERSION,
                    "Content-Type": "application/json",
                },
                method="POST",
            ),
            timeout=120,
        )

        audio_chunks: list[bytes] = []
        first_audio_delta_ms: float | None = None
        with response:
            while True:
                chunk = response.read(4096)
                if not chunk:
                    break
                if first_audio_delta_ms is None:
                    first_audio_delta_ms = round((time.perf_counter() - started_at) * 1000, 1)
                audio_chunks.append(chunk)

        if first_audio_delta_ms is None:
            raise RuntimeError("Cartesia returned no audio bytes")

        audio_bytes = b"".join(audio_chunks)
        return audio_bytes, first_audio_delta_ms, _measure_wav_duration_ms(audio_bytes)


def _build_word_timestamps(text: str, duration_ms: float) -> list[dict[str, object]]:
    words = text.split()
    if not words:
        return []
    step_ms = duration_ms / len(words)
    timestamps: list[dict[str, object]] = []
    for index, word in enumerate(words):
        start_ms = round(step_ms * index, 1)
        end_ms = round(duration_ms if index == len(words) - 1 else step_ms * (index + 1), 1)
        timestamps.append({"word": word, "start_ms": start_ms, "end_ms": end_ms})
    return timestamps


def _measure_wav_duration_ms(audio_bytes: bytes) -> float:
    if len(audio_bytes) < 44 or audio_bytes[:4] != b"RIFF" or audio_bytes[8:12] != b"WAVE":
        raise RuntimeError("Expected WAV audio bytes")

    offset = 12
    num_channels = 0
    sample_rate = 0
    bits_per_sample = 0
    data_offset: int | None = None
    data_size: int | None = None

    while offset + 8 <= len(audio_bytes):
        chunk_id = audio_bytes[offset : offset + 4]
        chunk_size = struct.unpack("<I", audio_bytes[offset + 4 : offset + 8])[0]
        chunk_start = offset + 8
        chunk_end = min(chunk_start + chunk_size, len(audio_bytes))

        if chunk_id == b"fmt " and chunk_end - chunk_start >= 16:
            fmt_data = audio_bytes[chunk_start : chunk_start + 16]
            _audio_format, num_channels, sample_rate, _byte_rate, _block_align, bits_per_sample = struct.unpack(
                "<HHIIHH",
                fmt_data,
            )
        if chunk_id == b"data":
            data_offset = chunk_start
            data_size = chunk_size
            break

        offset = chunk_start + chunk_size + (chunk_size % 2)

    if not num_channels or not sample_rate or not bits_per_sample or data_offset is None:
        raise RuntimeError("Could not parse WAV format information")

    if data_size is None or data_size == 0xFFFFFFFF or data_offset + data_size > len(audio_bytes):
        data_size = len(audio_bytes) - data_offset

    bytes_per_sample = bits_per_sample / 8
    frame_count = data_size / (num_channels * bytes_per_sample)
    return round((frame_count / sample_rate) * 1000, 1)
