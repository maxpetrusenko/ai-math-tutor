# Lane 1 STT Provider Abstraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the synthetic transcript path with a provider-agnostic streaming STT session interface and a Deepgram-backed implementation.

**Architecture:** Keep the existing `/ws/session` spine and move STT behind a narrow provider/session contract owned by the backend session layer. Browser audio chunks stream to the backend over the existing socket, the backend forwards bytes to the active STT session, and LLM dispatch begins only after the STT session emits a committed final transcript.

**Tech Stack:** FastAPI, WebSocket, Python 3.11, pytest, Deepgram streaming STT, browser MediaRecorder.

---

### Task 1: Lock the STT contract in tests

**Files:**
- Modify: `tests/stt/test_deepgram_client.py`
- Modify: `tests/session/test_server_pipeline.py`

**Step 1: Write the failing test**

- Add a provider/session-oriented test that proves partial-stable and final transcript events are emitted through a session object, not a one-shot handler.
- Add a server pipeline test that proves `audio.chunk.bytes_b64` is accepted and `speech.end` triggers transcript finalization without trusting the textarea prompt as ground truth.

**Step 2: Run test to verify it fails**

Run: `pytest tests/stt/test_deepgram_client.py tests/session/test_server_pipeline.py -v`

**Step 3: Write minimal implementation**

- Introduce a provider/session abstraction and update the tests to target that interface.

**Step 4: Run test to verify it passes**

Run: `pytest tests/stt/test_deepgram_client.py tests/session/test_server_pipeline.py -v`

**Step 5: Commit**

```bash
git add tests/stt/test_deepgram_client.py tests/session/test_server_pipeline.py
git commit -m "test: lock streaming stt session contract"
```

### Task 2: Implement provider abstraction and Deepgram adapter

**Files:**
- Add: `backend/stt/provider.py`
- Modify: `backend/stt/deepgram_client.py`

**Step 1: Write the failing test**

- Add coverage for provider startup, audio push behavior, finalize behavior, and close semantics.

**Step 2: Run test to verify it fails**

Run: `pytest tests/stt/test_deepgram_client.py -v`

**Step 3: Write minimal implementation**

- Add a provider/session protocol.
- Refactor Deepgram logic into a session object that owns transcript stabilization and provider metadata.
- Keep transport wiring injectable so future STT providers can swap without changing the session server.

**Step 4: Run test to verify it passes**

Run: `pytest tests/stt/test_deepgram_client.py -v`

**Step 5: Commit**

```bash
git add backend/stt/provider.py backend/stt/deepgram_client.py tests/stt/test_deepgram_client.py
git commit -m "feat: add provider-agnostic stt session"
```

### Task 3: Wire the realtime session server

**Files:**
- Modify: `backend/session/server.py`
- Modify: `backend/turn_taking/controller.py`
- Modify: `tests/session/test_server_pipeline.py`
- Modify: `tests/session/test_server.py`

**Step 1: Write the failing test**

- Add server tests proving:
  - a provider session is created once per websocket session
  - byte chunks are forwarded to STT
  - `speech.end` finalizes STT before LLM work begins
  - transcript final events, not textarea text, drive history and prompt construction

**Step 2: Run test to verify it fails**

Run: `pytest tests/session/test_server.py tests/session/test_server_pipeline.py -v`

**Step 3: Write minimal implementation**

- Store one STT session per websocket connection.
- Extend `audio.chunk` handling to accept optional `bytes_b64`.
- Finalize the STT session on `speech.end`, then run the existing LLM/TTS path from the emitted final transcript.

**Step 4: Run test to verify it passes**

Run: `pytest tests/session/test_server.py tests/session/test_server_pipeline.py -v`

**Step 5: Commit**

```bash
git add backend/session/server.py backend/turn_taking/controller.py tests/session/test_server.py tests/session/test_server_pipeline.py
git commit -m "feat: wire streaming stt into session server"
```

### Task 4: Send real browser audio bytes

**Files:**
- Modify: `frontend/lib/audio_capture.ts`
- Modify: `frontend/lib/session_socket.ts`

**Step 1: Write the failing test**

- Add or update frontend transport tests so captured audio chunks carry sequence, size, and base64 bytes into the socket payload.

**Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- --runInBand`

**Step 3: Write minimal implementation**

- Convert recorded blobs to base64 payloads.
- Send `audio.chunk.bytes_b64` while preserving current sequence/size fields for observability.

**Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test -- --runInBand`

**Step 5: Commit**

```bash
git add frontend/lib/audio_capture.ts frontend/lib/session_socket.ts
git commit -m "feat: stream browser audio bytes to stt session"
```

### Task 5: Verify lane 1

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Step 1: Write the failing test**

- Add documentation/env assertions only if repo already tests them; otherwise skip and verify manually.

**Step 2: Run verification**

Run: `pytest tests/stt/test_deepgram_client.py tests/session/test_server.py tests/session/test_server_pipeline.py -v`

Run: `pytest -v`

**Step 3: Update docs**

- Document the new STT env var contract and `audio.chunk.bytes_b64` behavior.

**Step 4: Run final verification**

Run: `pytest -v`

**Step 5: Commit**

```bash
git add .env.example README.md
git commit -m "docs: document streaming stt session setup"
```
