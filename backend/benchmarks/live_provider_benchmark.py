from __future__ import annotations

from dataclasses import dataclass
import json
import logging
import os
import struct
import time
from typing import Any
from urllib import error, parse, request

from backend.ai.call_logging import run_logged_ai_call
from backend.benchmarks.run_latency_benchmark import (
    BenchmarkOutcome,
    BenchmarkPrompt,
    build_benchmark_outcome,
    load_canned_prompts,
    load_local_env,
)
from backend.llm.langchain_bridge import summarize_langchain_llm_input, summarize_langchain_llm_output
from backend.llm.prompt_builder import build_tutor_messages
from backend.monitoring.latency_tracker import LatencyTracker

DEEPGRAM_LISTEN_URL = "https://api.deepgram.com/v1/listen"
GEMINI_STREAM_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent"
CARTESIA_BYTES_URL = "https://api.cartesia.ai/tts/bytes"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_DEEPGRAM_MODEL = "nova-2"
DEFAULT_CARTESIA_MODEL = "sonic-2"
DEFAULT_CARTESIA_VOICE_ID = "694f9389-aac1-45b6-b726-9d9369183238"
DEFAULT_CARTESIA_LANGUAGE = "en"
DEFAULT_WAV_SAMPLE_RATE = 22050
CARTESIA_VERSION = "2025-04-16"
logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class LiveProviderStackConfig:
    deepgram_api_key: str
    deepgram_model: str
    gemini_api_key: str
    gemini_model: str
    cartesia_api_key: str
    cartesia_model: str
    cartesia_voice_id: str
    cartesia_language: str
    sample_rate: int


def run_live_provider_benchmark(
    path: str,
    *,
    runs_per_prompt: int = 1,
) -> BenchmarkOutcome:
    load_local_env()
    config = _resolve_config()
    prompts = load_canned_prompts(path)
    trackers: list[LatencyTracker] = []
    raw_event_logs: list[dict[str, object]] = []

    for prompt in prompts:
        for iteration in range(runs_per_prompt):
            tracker, metadata = _run_live_prompt(prompt, config=config)
            trackers.append(tracker)
            raw_event_logs.append(
                {
                    "mode": "live",
                    "prompt_id": prompt.id,
                    "iteration": iteration,
                    "events": [
                        {
                            "name": event.name,
                            "ts_ms": event.ts_ms,
                            "metadata": event.metadata,
                        }
                        for event in tracker.events
                    ],
                    "provider_stack": metadata["provider_stack"],
                    "student_transcript": metadata["student_transcript"],
                    "llm_text": metadata["llm_text"],
                    "notes": metadata["notes"],
                }
            )

    return build_benchmark_outcome(mode="live", trackers=trackers, raw_event_logs=raw_event_logs)


def _run_live_prompt(
    prompt: BenchmarkPrompt,
    *,
    config: LiveProviderStackConfig,
) -> tuple[LatencyTracker, dict[str, object]]:
    tracker = LatencyTracker()
    benchmark_started_at = time.perf_counter()
    tracker.mark("speech_end", 0.0, {"prompt_id": prompt.id})

    student_audio_bytes, _student_first_audio_ms, student_audio_duration_ms = synthesize_speech_bytes(
        prompt.student_transcript,
        config=config,
    )

    transcript_text, stt_elapsed_ms = transcribe_with_deepgram(student_audio_bytes, config=config)
    tracker.mark(
        "stt_partial_stable",
        stt_elapsed_ms,
        {"provider": "deepgram", "model": config.deepgram_model, "source": "prerecorded_proxy"},
    )
    tracker.mark(
        "stt_final",
        stt_elapsed_ms,
        {"provider": "deepgram", "model": config.deepgram_model},
    )

    tutor_messages = build_tutor_messages(
        subject=prompt.subject,
        grade_band=prompt.grade_band,
        latest_student_text=transcript_text,
        history=[],
        student_profile=None,
    )
    llm_stage_started_ms = _elapsed_ms(benchmark_started_at)
    tutor_text, llm_first_token_delta_ms = generate_tutor_text(tutor_messages, config=config)
    llm_first_token_ms = llm_stage_started_ms + llm_first_token_delta_ms
    tracker.mark(
        "llm_first_token",
        llm_first_token_ms,
        {"provider": "gemini", "model": config.gemini_model},
    )

    tts_stage_started_ms = _elapsed_ms(benchmark_started_at)
    tutor_audio_bytes, tts_first_audio_delta_ms, tutor_audio_duration_ms = synthesize_speech_bytes(
        tutor_text,
        config=config,
    )
    del tutor_audio_bytes
    tts_first_audio_ms = tts_stage_started_ms + tts_first_audio_delta_ms
    tracker.mark(
        "tts_first_audio",
        tts_first_audio_ms,
        {"provider": "cartesia", "model": config.cartesia_model, "voice_id": config.cartesia_voice_id},
    )
    tracker.mark(
        "first_viseme",
        tts_first_audio_ms,
        {
            "provider": "cartesia",
            "model": config.cartesia_model,
            "voice_id": config.cartesia_voice_id,
            "source": "tts_first_audio_proxy",
        },
    )
    tracker.mark(
        "audio_done",
        tts_first_audio_ms + tutor_audio_duration_ms,
        {
            "provider": "cartesia",
            "model": config.cartesia_model,
            "voice_id": config.cartesia_voice_id,
            "source": "wav_duration",
            "duration_ms": tutor_audio_duration_ms,
        },
    )

    return tracker, {
        "llm_text": tutor_text,
        "notes": {
            "student_audio_duration_ms": student_audio_duration_ms,
            "benchmark_wall_clock_ms": round((time.perf_counter() - benchmark_started_at) * 1000, 1),
            "stt_partial_stable_source": "prerecorded_proxy",
            "first_viseme_source": "tts_first_audio_proxy",
            "audio_done_source": "wav_duration",
        },
        "provider_stack": {
            "stt": {"provider": "deepgram", "model": config.deepgram_model},
            "llm": {"provider": "gemini", "model": config.gemini_model},
            "tts": {
                "provider": "cartesia",
                "model": config.cartesia_model,
                "voice_id": config.cartesia_voice_id,
            },
        },
        "student_transcript": transcript_text,
    }


def transcribe_with_deepgram(audio_bytes: bytes, *, config: LiveProviderStackConfig) -> tuple[str, float]:
    query = parse.urlencode(
        {
            "model": config.deepgram_model,
            "smart_format": "true",
            "punctuate": "true",
        }
    )
    started_at = time.perf_counter()
    payload = run_logged_ai_call(
        logger=logger,
        provider="deepgram",
        operation="benchmark.transcribe",
        request_payload={"model": config.deepgram_model, "audio_bytes": audio_bytes},
        call=lambda: _post_json(
            f"{DEEPGRAM_LISTEN_URL}?{query}",
            audio_bytes,
            headers={
                "Authorization": f"Token {config.deepgram_api_key}",
                "Content-Type": "audio/wav",
            },
            timeout_s=120,
        ),
        response_summarizer=lambda result: {
            "has_results": bool(result.get("results")),
            "transcript_preview": str(
                result.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("transcript", "")
            )[:120],
        },
    )
    elapsed_ms = _elapsed_ms(started_at)
    transcript = (
        payload["results"]["channels"][0]["alternatives"][0]["transcript"]
        if payload.get("results")
        else ""
    )
    if not transcript:
        raise RuntimeError("Deepgram returned an empty transcript")
    return str(transcript).strip(), elapsed_ms


def generate_tutor_text(
    messages: list[dict[str, str]],
    *,
    config: LiveProviderStackConfig,
) -> tuple[str, float]:
    joined_prompt = "\n\n".join(f"{message['role'].upper()}: {message['content']}" for message in messages)
    body = {
        "contents": [
            {
                "parts": [
                    {
                        "text": joined_prompt,
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 256,
        },
    }
    started_at = time.perf_counter()
    stream_url = (
        f"{GEMINI_STREAM_URL.format(model=config.gemini_model)}"
        f"?alt=sse&key={parse.quote(config.gemini_api_key)}"
    )
    try:
        result = run_logged_ai_call(
            logger=logger,
            provider="gemini",
            operation="benchmark.generate",
            request_payload={**summarize_langchain_llm_input(messages, model=config.gemini_model), "mode": "live"},
            call=lambda: _generate_tutor_text_live(
                stream_url=stream_url,
                body=body,
                started_at=started_at,
                messages=messages,
                config=config,
            ),
            response_summarizer=summarize_langchain_llm_output,
            langsmith_project="nerdy-live-benchmark",
            langsmith_run_type="llm",
        )
        return str(result["text"]), float(result["first_token_ms"])
    except error.HTTPError as http_error:
        error_body = http_error.read().decode("utf-8", errors="ignore")
        if http_error.code == 404 and config.gemini_model != "gemini-2.5-flash":
            fallback_config = LiveProviderStackConfig(
                deepgram_api_key=config.deepgram_api_key,
                deepgram_model=config.deepgram_model,
                gemini_api_key=config.gemini_api_key,
                gemini_model="gemini-2.5-flash",
                cartesia_api_key=config.cartesia_api_key,
                cartesia_model=config.cartesia_model,
                cartesia_voice_id=config.cartesia_voice_id,
                cartesia_language=config.cartesia_language,
                sample_rate=config.sample_rate,
            )
            return generate_tutor_text(messages, config=fallback_config)
        raise RuntimeError(f"Gemini request failed: {http_error.code} {error_body}") from http_error

def synthesize_speech_bytes(
    text: str,
    *,
    config: LiveProviderStackConfig,
) -> tuple[bytes, float, float]:
    body = {
        "model_id": config.cartesia_model,
        "transcript": text,
        "voice": {
            "mode": "id",
            "id": config.cartesia_voice_id,
        },
        "language": config.cartesia_language,
        "output_format": {
            "container": "wav",
            "encoding": "pcm_s16le",
            "sample_rate": config.sample_rate,
        },
    }
    started_at = time.perf_counter()
    return run_logged_ai_call(
        logger=logger,
        provider="cartesia",
        operation="benchmark.synthesize",
        request_payload={
            "model": config.cartesia_model,
            "voice_id": config.cartesia_voice_id,
            "language": config.cartesia_language,
            "text": text,
        },
        call=lambda: _synthesize_speech_bytes_live(body=body, config=config, started_at=started_at),
        response_summarizer=lambda result: {
            "audio_bytes": len(result[0]),
            "first_audio_ms": result[1],
            "duration_ms": result[2],
        },
    )

    audio_chunks: list[bytes] = []
    first_audio_ms: float | None = None
    with response:
        while True:
            chunk = response.read(4096)
            if not chunk:
                break
            if first_audio_ms is None:
                first_audio_ms = _elapsed_ms(started_at)
            audio_chunks.append(chunk)

    if first_audio_ms is None:
        raise RuntimeError("Cartesia returned no audio bytes")

    audio_bytes = b"".join(audio_chunks)
    return audio_bytes, first_audio_ms, measure_wav_duration_ms(audio_bytes)


def measure_wav_duration_ms(audio_bytes: bytes) -> float:
    if len(audio_bytes) < 44 or audio_bytes[:4] != b"RIFF" or audio_bytes[8:12] != b"WAVE":
        raise RuntimeError("Expected WAV audio bytes")

    offset = 12
    num_channels = 0
    sample_rate = 0
    bits_per_sample = 0
    data_offset: int | None = None
    data_size: int | None = None

    while offset + 8 <= len(audio_bytes):
        chunk_id = audio_bytes[offset:offset + 4]
        chunk_size = struct.unpack("<I", audio_bytes[offset + 4:offset + 8])[0]
        chunk_start = offset + 8
        chunk_end = min(chunk_start + chunk_size, len(audio_bytes))

        if chunk_id == b"fmt " and chunk_end - chunk_start >= 16:
            fmt_data = audio_bytes[chunk_start:chunk_start + 16]
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


def extract_gemini_text(payload: dict[str, Any]) -> str:
    texts: list[str] = []
    for candidate in payload.get("candidates", []):
        content = candidate.get("content", {})
        for part in content.get("parts", []):
            text = part.get("text")
            if isinstance(text, str):
                texts.append(text)
    return "".join(texts)


def _post_json(
    url: str,
    body: bytes,
    *,
    headers: dict[str, str],
    timeout_s: int,
) -> dict[str, Any]:
    response = request.urlopen(
        request.Request(url, data=body, headers=headers, method="POST"),
        timeout=timeout_s,
    )
    with response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("Expected JSON object response")
    return payload


def _generate_tutor_text_live(
    *,
    stream_url: str,
    body: dict[str, Any],
    started_at: float,
    messages: list[dict[str, str]],
    config: LiveProviderStackConfig,
) -> dict[str, str | float]:
    response = request.urlopen(
        request.Request(
            stream_url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        ),
        timeout=120,
    )

    text_parts: list[str] = []
    first_token_ms: float | None = None
    with response:
        for raw_line in response:
            line = raw_line.decode("utf-8").strip()
            if not line.startswith("data:"):
                continue
            payload = json.loads(line[5:].strip())
            text = extract_gemini_text(payload)
            if not text:
                continue
            if first_token_ms is None:
                first_token_ms = _elapsed_ms(started_at)
            text_parts.append(text)

    if first_token_ms is None:
        raise RuntimeError("Gemini did not emit a text chunk")

    tutor_text = "".join(text_parts).strip()
    if not tutor_text:
        raise RuntimeError("Gemini returned an empty tutor response")
    return {
        "provider": "gemini",
        "model": config.gemini_model,
        "text": tutor_text,
        "first_token_ms": first_token_ms,
        "input_messages": str(len(messages)),
    }


def _synthesize_speech_bytes_live(
    *,
    body: dict[str, Any],
    config: LiveProviderStackConfig,
    started_at: float,
) -> tuple[bytes, float, float]:
    response = request.urlopen(
        request.Request(
            CARTESIA_BYTES_URL,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {config.cartesia_api_key}",
                "Cartesia-Version": CARTESIA_VERSION,
                "Content-Type": "application/json",
            },
            method="POST",
        ),
        timeout=120,
    )

    audio_chunks: list[bytes] = []
    first_audio_ms: float | None = None
    with response:
        while True:
            chunk = response.read(4096)
            if not chunk:
                break
            if first_audio_ms is None:
                first_audio_ms = _elapsed_ms(started_at)
            audio_chunks.append(chunk)

    if first_audio_ms is None:
        raise RuntimeError("Cartesia returned no audio bytes")

    audio_bytes = b"".join(audio_chunks)
    return audio_bytes, first_audio_ms, measure_wav_duration_ms(audio_bytes)


def _resolve_config() -> LiveProviderStackConfig:
    deepgram_api_key = _require_env("DEEPGRAM_API_KEY")
    gemini_api_key = os.getenv("GEMINI_API_KEY") or _require_env("GOOGLE_AI_API_KEY")
    cartesia_api_key = _require_env("CARTESIA_API_KEY")
    return LiveProviderStackConfig(
        deepgram_api_key=deepgram_api_key,
        deepgram_model=os.getenv("NERDY_BENCHMARK_STT_MODEL", DEFAULT_DEEPGRAM_MODEL),
        gemini_api_key=gemini_api_key,
        gemini_model=os.getenv("NERDY_BENCHMARK_LLM_MODEL", DEFAULT_GEMINI_MODEL),
        cartesia_api_key=cartesia_api_key,
        cartesia_model=os.getenv("NERDY_BENCHMARK_TTS_MODEL", DEFAULT_CARTESIA_MODEL),
        cartesia_voice_id=os.getenv("NERDY_TTS_VOICE_CARTESIA", DEFAULT_CARTESIA_VOICE_ID),
        cartesia_language=os.getenv("NERDY_BENCHMARK_TTS_LANGUAGE", DEFAULT_CARTESIA_LANGUAGE),
        sample_rate=int(os.getenv("NERDY_BENCHMARK_TTS_SAMPLE_RATE", str(DEFAULT_WAV_SAMPLE_RATE))),
    )


def _require_env(key: str) -> str:
    value = os.getenv(key, "").strip()
    if not value:
        raise RuntimeError(f"{key} is required for live provider benchmark")
    return value


def _elapsed_ms(started_at: float) -> float:
    return round((time.perf_counter() - started_at) * 1000, 1)
