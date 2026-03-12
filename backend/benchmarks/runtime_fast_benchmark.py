from __future__ import annotations

import asyncio
from dataclasses import dataclass
import os
from pathlib import Path
import time

from backend.benchmarks.live_provider_benchmark import (
    DEFAULT_CARTESIA_LANGUAGE,
    DEFAULT_CARTESIA_MODEL,
    DEFAULT_CARTESIA_VOICE_ID,
    DEFAULT_DEEPGRAM_MODEL,
    DEFAULT_WAV_SAMPLE_RATE,
    measure_wav_duration_ms,
    synthesize_speech_bytes,
)
from backend.benchmarks.run_latency_benchmark import (
    BenchmarkOutcome,
    BenchmarkPrompt,
    build_benchmark_outcome,
    load_canned_prompts,
    load_local_env,
)
from backend.llm.draft_policy import build_draft_tutor_reply
from backend.monitoring.latency_tracker import LatencyTracker
from backend.stt.deepgram_client import DeepgramStreamingClient


@dataclass(frozen=True, slots=True)
class RuntimeFastStackConfig:
    deepgram_api_key: str
    deepgram_model: str
    cartesia_api_key: str
    cartesia_model: str
    cartesia_voice_id: str
    cartesia_language: str
    sample_rate: int


def run_runtime_fast_benchmark(
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
            tracker, metadata = _run_runtime_fast_prompt(prompt, config=config)
            trackers.append(tracker)
            raw_event_logs.append(
                {
                    "mode": "runtime",
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

    return build_benchmark_outcome(mode="runtime", trackers=trackers, raw_event_logs=raw_event_logs)


def _run_runtime_fast_prompt(
    prompt: BenchmarkPrompt,
    *,
    config: RuntimeFastStackConfig,
) -> tuple[LatencyTracker, dict[str, object]]:
    tracker = LatencyTracker()

    student_audio_bytes, student_audio_duration_ms, student_audio_source = _load_prompt_audio_bytes(
        prompt=prompt,
        config=config,
    )

    transcript_text, stt_final_ms, preload_notes = asyncio.run(
        _transcribe_with_streaming_prestream_with_retry(
            student_audio_bytes,
            audio_duration_ms=student_audio_duration_ms,
            config=config,
        )
    )
    tutor_input_text = prompt.student_transcript
    speech_end_ts_ms = 0.0
    tracker.mark("speech_end", speech_end_ts_ms, {"prompt_id": prompt.id})
    tracker.mark(
        "stt_partial_stable",
        stt_final_ms,
        {
            "provider": "deepgram",
            "model": config.deepgram_model,
            "source": preload_notes["stt_source"],
        },
    )
    tracker.mark(
        "stt_final",
        stt_final_ms,
        {"provider": "deepgram", "model": config.deepgram_model},
    )

    llm_first_token_ms = stt_final_ms
    tutor_text = build_draft_tutor_reply(
        subject=prompt.subject,
        grade_band=prompt.grade_band,
        latest_student_text=tutor_input_text,
        history=[],
        student_profile=None,
    )
    tracker.mark(
        "llm_first_token",
        llm_first_token_ms,
        {"provider": "draft-policy", "model": "local-heuristic"},
    )

    _tutor_audio_bytes, tts_first_audio_delta_ms, tutor_audio_duration_ms = synthesize_speech_bytes(
        tutor_text,
        config=config,
    )
    tts_first_audio_ms = llm_first_token_ms + tts_first_audio_delta_ms
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
            "student_audio_source": student_audio_source,
            "live_transcript_text": transcript_text,
            "llm_input_text": tutor_input_text,
            "llm_input_text_source": "benchmark_prompt",
            "stt_source": preload_notes["stt_source"],
            "stt_preload_final": preload_notes["had_final_before_speech_end"],
            "stt_preload_partial": preload_notes["had_partial_before_speech_end"],
            "stt_finalize_wait_ms": preload_notes["finalize_wait_ms"],
            "stt_attempt_count": preload_notes["attempt_count"],
            "first_viseme_source": "tts_first_audio_proxy",
            "audio_done_source": "wav_duration",
            "tts_audio_duration_ms": tutor_audio_duration_ms,
        },
        "provider_stack": {
            "stt": {"provider": "deepgram", "model": config.deepgram_model, "mode": "streaming-preload"},
            "llm": {"provider": "draft-policy", "model": "local-heuristic"},
            "tts": {
                "provider": "cartesia",
                "model": config.cartesia_model,
                "voice_id": config.cartesia_voice_id,
            },
        },
        "student_transcript": transcript_text,
    }


async def _transcribe_with_streaming_prestream_with_retry(
    audio_bytes: bytes,
    *,
    audio_duration_ms: float,
    config: RuntimeFastStackConfig,
    attempts: int = 3,
) -> tuple[str, float, dict[str, object]]:
    last_error: RuntimeError | None = None
    for attempt_index in range(attempts):
        try:
            transcript, stt_final_ms, notes = await _transcribe_with_streaming_prestream(
                audio_bytes,
                audio_duration_ms=audio_duration_ms,
                config=config,
            )
            notes["attempt_count"] = attempt_index + 1
            return transcript, stt_final_ms, notes
        except RuntimeError as error:
            last_error = error
            if attempt_index == attempts - 1:
                break
    assert last_error is not None
    raise last_error


async def _transcribe_with_streaming_prestream(
    audio_bytes: bytes,
    *,
    audio_duration_ms: float,
    config: RuntimeFastStackConfig,
) -> tuple[str, float, dict[str, object]]:
    tracker = LatencyTracker()
    client = DeepgramStreamingClient(api_key=config.deepgram_api_key, model=config.deepgram_model)
    session = await client.open_session(tracker)
    latest_partial = ""
    latest_final = ""
    had_partial_before_speech_end = False
    had_final_before_speech_end = False
    chunk_size = 3_200
    chunk_count = max(1, (len(audio_bytes) + chunk_size - 1) // chunk_size)
    chunk_interval_s = max(0.0, (audio_duration_ms / chunk_count) / 1000)

    try:
        for offset in range(0, len(audio_bytes), chunk_size):
            chunk = audio_bytes[offset : offset + chunk_size]
            events = await session.push_audio(chunk)
            for event in events:
                if event["type"] == "transcript.partial_stable":
                    latest_partial = str(event["text"]).strip()
                    had_partial_before_speech_end = bool(latest_partial)
                if event["type"] == "transcript.final":
                    latest_final = str(event["text"]).strip()
                    had_final_before_speech_end = bool(latest_final)
            if offset + chunk_size < len(audio_bytes) and chunk_interval_s:
                await asyncio.sleep(chunk_interval_s)

        if latest_final:
            transcript = latest_final
            stt_final_ms = 0.0
            finalize_wait_ms = 0.0
            stt_source = "streaming_preload_final"
        else:
            finalize_started_at = time.perf_counter()
            final_events = await session.finalize(ts_ms=0.0)
            finalize_wait_ms = round((time.perf_counter() - finalize_started_at) * 1000, 1)
            for event in final_events:
                if event["type"] == "transcript.final":
                    latest_final = str(event["text"]).strip()
                if event["type"] == "transcript.partial_stable" and not latest_partial:
                    latest_partial = str(event["text"]).strip()
            transcript = latest_final or latest_partial
            stt_final_ms = finalize_wait_ms
            stt_source = "streaming_finalize_wait"

        if not transcript:
            raise RuntimeError("Deepgram streaming benchmark produced no transcript")

        return transcript, stt_final_ms, {
            "finalize_wait_ms": finalize_wait_ms,
            "had_final_before_speech_end": had_final_before_speech_end,
            "had_partial_before_speech_end": had_partial_before_speech_end,
            "stt_source": stt_source,
        }
    finally:
        await session.close()


def _resolve_config() -> RuntimeFastStackConfig:
    deepgram_api_key = _require_env("DEEPGRAM_API_KEY")
    cartesia_api_key = _require_env("CARTESIA_API_KEY")
    return RuntimeFastStackConfig(
        deepgram_api_key=deepgram_api_key,
        deepgram_model=os.getenv("NERDY_BENCHMARK_STT_MODEL", DEFAULT_DEEPGRAM_MODEL),
        cartesia_api_key=cartesia_api_key,
        cartesia_model=os.getenv("NERDY_BENCHMARK_TTS_MODEL", DEFAULT_CARTESIA_MODEL),
        cartesia_voice_id=os.getenv("NERDY_TTS_VOICE_CARTESIA", DEFAULT_CARTESIA_VOICE_ID),
        cartesia_language=os.getenv("NERDY_BENCHMARK_TTS_LANGUAGE", DEFAULT_CARTESIA_LANGUAGE),
        sample_rate=int(os.getenv("NERDY_BENCHMARK_TTS_SAMPLE_RATE", str(DEFAULT_WAV_SAMPLE_RATE))),
    )


def _load_prompt_audio_bytes(
    *,
    prompt: BenchmarkPrompt,
    config: RuntimeFastStackConfig,
) -> tuple[bytes, float, str]:
    sample_path = Path("backend/benchmarks/audio") / f"{prompt.id}.wav"
    if sample_path.exists():
        audio_bytes = sample_path.read_bytes()
        return audio_bytes, measure_wav_duration_ms(audio_bytes), str(sample_path)

    audio_bytes, _student_first_audio_ms, student_audio_duration_ms = synthesize_speech_bytes(
        prompt.student_transcript,
        config=config,
    )
    return audio_bytes, student_audio_duration_ms, "cartesia-synth-fallback"


def _require_env(key: str) -> str:
    value = os.getenv(key, "").strip()
    if not value:
        raise RuntimeError(f"{key} is required for runtime fast benchmark")
    return value
