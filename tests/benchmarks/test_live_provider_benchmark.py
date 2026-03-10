from __future__ import annotations

import struct

from backend.benchmarks.live_provider_benchmark import extract_gemini_text, measure_wav_duration_ms


def test_extract_gemini_text_concatenates_stream_parts() -> None:
    payload = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": "Hello"},
                        {"text": " world"},
                    ]
                }
            }
        ]
    }

    assert extract_gemini_text(payload) == "Hello world"


def test_measure_wav_duration_ms_reads_pcm_wav_length() -> None:
    sample_rate = 8000
    bits_per_sample = 16
    num_channels = 1
    frame_count = 8000
    data_bytes = b"\x00\x00" * frame_count
    byte_rate = sample_rate * num_channels * (bits_per_sample // 8)
    block_align = num_channels * (bits_per_sample // 8)

    wav_bytes = (
        b"RIFF"
        + struct.pack("<I", 0xFFFFFFFF)
        + b"WAVE"
        + b"fmt "
        + struct.pack("<IHHIIHH", 16, 1, num_channels, sample_rate, byte_rate, block_align, bits_per_sample)
        + b"data"
        + struct.pack("<I", 0xFFFFFFFF)
        + data_bytes
    )

    assert measure_wav_duration_ms(wav_bytes) == 1000.0
