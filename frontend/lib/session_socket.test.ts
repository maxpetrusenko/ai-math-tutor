import { afterEach, vi } from "vitest";

import { createSessionSocketTransport } from "./session_socket";


class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readonly sent: string[] = [];
  readonly url: string;
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.onopen?.();
    });
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  emit(payload: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }

  emitError() {
    this.onerror?.();
  }

  emitClose() {
    this.onclose?.();
  }
}


afterEach(() => {
  FakeWebSocket.instances = [];
  vi.unstubAllGlobals();
});


test("session transport sends audio bytes before speech end", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  const runPromise = transport.runTurn({
    studentText: "typed fallback",
    subject: "math",
    gradeBand: "6-8",
    audioChunks: [{ sequence: 1, size: 3, bytesBase64: "YWJj" }]
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];
  const sentPayloads = socket.sent.map((payload) => JSON.parse(payload) as Record<string, unknown>);

  expect(sentPayloads[0]).toEqual({
    type: "audio.chunk",
    sequence: 1,
    size: 3,
    bytes_b64: "YWJj"
  });
  expect(sentPayloads[1]).toMatchObject({
    type: "speech.end",
    text: "typed fallback",
    subject: "math",
    grade_band: "6-8"
  });

  socket.emit({ type: "transcript.final", text: "heard from audio" });
  socket.emit({ type: "state.changed", state: "speaking" });
  socket.emit({ type: "tutor.text.committed", text: "Nice start." });
  socket.emit({
    type: "tts.audio",
    timestamps: [{ word: "Nice", start_ms: 0, end_ms: 100 }]
  });

  await expect(runPromise).resolves.toMatchObject({
    transcript: "heard from audio",
    tutorText: "Nice start.",
    state: "speaking"
  });
});

test("session transport returns failed when websocket connect errors", async () => {
  class ErrorWebSocket {
    static OPEN = 1;

    readonly sent: string[] = [];
    readonly url: string;
    readyState = ErrorWebSocket.OPEN;
    onopen: (() => void) | null = null;
    onmessage: ((event: MessageEvent<string>) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;

    constructor(url: string) {
      this.url = url;
      queueMicrotask(() => {
        this.onerror?.();
      });
    }

    send(payload: string) {
      this.sent.push(payload);
    }
  }

  vi.stubGlobal("WebSocket", ErrorWebSocket as unknown as typeof WebSocket);

  await expect(createSessionSocketTransport().connect()).resolves.toBe("failed");
});

test("session transport sends interrupt on the open socket", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  await transport.connect();
  await transport.interrupt();

  expect(FakeWebSocket.instances[0]?.sent.map((payload) => JSON.parse(payload))).toContainEqual({ type: "interrupt" });
});

test("session transport rejects active turn on session error", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  const runPromise = transport.runTurn({
    studentText: "typed fallback",
    subject: "math",
    gradeBand: "6-8",
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  FakeWebSocket.instances[0]?.emit({ type: "session.error", message: "provider offline" });

  await expect(runPromise).rejects.toThrow("provider offline");
});

test("session transport rejects active turn when socket closes mid turn", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  const runPromise = transport.runTurn({
    studentText: "typed fallback",
    subject: "math",
    gradeBand: "6-8",
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  FakeWebSocket.instances[0]?.emitClose();

  await expect(runPromise).rejects.toThrow("WebSocket connection closed");
});

test("session transport sends text-only turns without fake audio chunks", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  const runPromise = transport.runTurn({
    studentText: "text only",
    subject: "math",
    gradeBand: "6-8",
    audioChunks: [],
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];
  const sentPayloads = socket.sent.map((payload) => JSON.parse(payload) as Record<string, unknown>);

  expect(sentPayloads).toHaveLength(1);
  expect(sentPayloads[0]).toMatchObject({
    type: "speech.end",
    text: "text only",
  });

  socket.emit({ type: "transcript.final", text: "text only" });
  socket.emit({ type: "state.changed", state: "speaking" });
  socket.emit({ type: "tutor.text.committed", text: "Good start." });
  socket.emit({ type: "tts.audio", timestamps: [{ word: "Good", start_ms: 0, end_ms: 100 }] });

  await expect(runPromise).resolves.toMatchObject({ transcript: "text only" });
});

test("session transport waits for the final tts chunk before resolving the turn", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  const runPromise = transport.runTurn({
    studentText: "full answer please",
    subject: "math",
    gradeBand: "6-8",
    audioChunks: [],
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];

  socket.emit({ type: "transcript.final", text: "full answer please" });
  socket.emit({ type: "state.changed", state: "speaking" });
  socket.emit({ type: "tutor.text.committed", text: "First phrase," });
  socket.emit({
    type: "tts.audio",
    audio_b64: "YQ==",
    audio_mime_type: "audio/wav",
    is_final: false,
    timestamps: [{ word: "First", start_ms: 0, end_ms: 100 }],
  });

  let settled = false;
  runPromise.finally(() => {
    settled = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(settled).toBe(false);

  socket.emit({ type: "tutor.text.committed", text: "second phrase." });
  socket.emit({
    type: "tts.audio",
    audio_b64: "Yg==",
    audio_mime_type: "audio/wav",
    is_final: true,
    timestamps: [{ word: "second", start_ms: 0, end_ms: 120 }],
  });

  await expect(runPromise).resolves.toMatchObject({
    transcript: "full answer please",
    tutorText: "First phrase, second phrase.",
    audioSegments: [
      {
        text: "First phrase,",
        audioBase64: "YQ==",
        audioMimeType: "audio/wav",
        durationMs: 100,
      },
      {
        text: "second phrase.",
        audioBase64: "Yg==",
        audioMimeType: "audio/wav",
        durationMs: 120,
      },
    ],
    timestamps: [
      { word: "First", startMs: 0, endMs: 100 },
      { word: "second", startMs: 100, endMs: 220 },
    ],
  });
});

test("session transport resets the active lesson", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  await transport.connect();
  const resetPromise = transport.reset();

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(FakeWebSocket.instances[0]?.sent.map((payload) => JSON.parse(payload))).toContainEqual({ type: "session.reset" });

  FakeWebSocket.instances[0]?.emit({ type: "session.reset", state: "idle" });

  await expect(resetPromise).resolves.toBeUndefined();
});

test("session transport can switch websocket sessions and restore lesson history", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  const restorePromise = transport.switchSession?.("lesson-42", {
    avatarProviderId: "robot-css-2d",
    conversation: [
      {
        id: "1",
        transcript: "saved question",
        tutorText: "saved answer",
      },
    ],
    gradeBand: "6-8",
    preference: "slow down",
    sessionId: "lesson-42",
    studentPrompt: "saved question",
    subject: "math",
    transcript: "saved question",
    tutorText: "saved answer",
    version: 1,
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];
  expect(socket?.url).toContain("session_id=lesson-42");
  expect(socket?.sent.map((payload) => JSON.parse(payload))).toContainEqual({
    type: "session.restore",
    grade_band: "6-8",
    history: [
      { role: "user", content: "saved question" },
      { role: "assistant", content: "saved answer" },
    ],
    student_profile: { preference: "slow down" },
    subject: "math",
  });

  socket?.emit({ type: "session.restored", session_id: "lesson-42", history_length: 2, state: "idle" });
  await expect(restorePromise).resolves.toBeUndefined();
  expect(transport.getSessionId?.()).toBe("lesson-42");
});
