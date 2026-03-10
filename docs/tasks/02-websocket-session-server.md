# Task 02: WebSocket Session Server

## Goal

Implement the backend WebSocket session path and single turn-boundary authority.

## Owner

Backend realtime engineer

## Depends On

- Task 01 event schema

## Planned Files

- `backend/session/server.py`
- `backend/turn_taking/controller.py`
- `backend/turn_taking/state.py`

## Deliverables

- session WebSocket endpoint
- session lifecycle
- turn-state machine
- interruption entry points

## Done Criteria

- client can connect and stream audio
- tutor events stream back to client
- one backend component clearly owns turn state

## Parallel

Blocks Tasks 03, 04, and 08.
