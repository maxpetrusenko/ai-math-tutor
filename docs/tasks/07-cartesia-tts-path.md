# Task 07: Cartesia TTS Path

## Goal

Implement Cartesia WebSocket TTS for committed playback.

## Owner

Backend integrations engineer

## Depends On

- Task 06

## Planned Files

- `backend/tts/cartesia_client.py`
- `backend/tts/audio_buffer.py`

## Deliverables

- Cartesia client
- timestamp capture
- flush control
- audio buffering hooks

## Done Criteria

- committed text becomes streamed audio
- `tts_first_audio` is recorded
- timestamps are available for the avatar

## Parallel

Blocks Task 09 and Task 10.
