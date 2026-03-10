from backend.tts.audio_buffer import AudioBuffer


def test_audio_buffer_preserves_order_and_reset() -> None:
    buffer = AudioBuffer()

    buffer.push(b"chunk-1")
    buffer.push(b"chunk-2")

    assert buffer.drain() == [b"chunk-1", b"chunk-2"]
    buffer.push(b"chunk-3")
    buffer.reset()
    assert buffer.drain() == []
