import { afterEach, vi } from "vitest";

const { getCurrentFirebaseIdToken, getFirebaseAuthClient } = vi.hoisted(() => ({
  getCurrentFirebaseIdToken: vi.fn<() => Promise<string | null>>(),
  getFirebaseAuthClient: vi.fn<() => object | null>(),
}));

vi.mock("./firebase_auth", () => ({
  getCurrentFirebaseIdToken,
}));

vi.mock("./firebase_client", () => ({
  getFirebaseAuthClient,
}));

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
  getCurrentFirebaseIdToken.mockReset();
  getCurrentFirebaseIdToken.mockResolvedValue(null);
  getFirebaseAuthClient.mockReset();
  getFirebaseAuthClient.mockReturnValue(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});


test("session transport sends audio bytes before speech end", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  const runPromise = transport.runTurn({
    studentText: "typed fallback",
    subject: "math",
    gradeBand: "6-8",
    llmProvider: "minimax",
    llmModel: "minimax-m2.5",
    ttsProvider: "minimax",
    ttsModel: "minimax-speech",
    audioChunks: [{ sequence: 1, size: 3, bytesBase64: "YWJj", mimeType: "audio/webm;codecs=opus" }]
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];
  const sentPayloads = socket.sent.map((payload) => JSON.parse(payload) as Record<string, unknown>);

  expect(sentPayloads[0]).toEqual({
    type: "audio.chunk",
    sequence: 1,
    size: 3,
    bytes_b64: "YWJj",
    mime_type: "audio/webm;codecs=opus",
    ts_ms: expect.any(Number),
  });
  expect(sentPayloads[1]).toMatchObject({
    type: "speech.end",
    text: "typed fallback",
    subject: "math",
    grade_band: "6-8",
    llm_provider: "minimax",
    llm_model: "minimax-m2.5",
    tts_provider: "minimax",
    tts_model: "minimax-speech",
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

test("session transport exposes transcript final before the turn resolves", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const onTranscriptFinal = vi.fn();
  const transport = createSessionSocketTransport();
  const runPromise = transport.runTurn({
    studentText: "",
    subject: "math",
    gradeBand: "6-8",
    audioChunks: [{ sequence: 1, size: 3, bytesBase64: "YWJj", mimeType: "audio/webm;codecs=opus" }],
    onTranscriptFinal,
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];

  socket.emit({ type: "transcript.final", text: "2+2" });
  expect(onTranscriptFinal).toHaveBeenCalledWith("2+2");

  socket.emit({ type: "state.changed", state: "speaking" });
  socket.emit({ type: "tutor.text.committed", text: "4" });
  socket.emit({
    type: "tts.audio",
    timestamps: [{ word: "4", start_ms: 0, end_ms: 100 }],
  });

  await expect(runPromise).resolves.toMatchObject({ transcript: "2+2" });
});

test("session transport logs audio chunk and speech end summaries before socket close", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
  const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  const transport = createSessionSocketTransport();
  const runPromise = transport.runTurn({
    studentText: "typed fallback",
    subject: "math",
    gradeBand: "6-8",
    audioChunks: [{ sequence: 2, size: 1280, bytesBase64: "YWJjZA==", mimeType: "audio/webm" }],
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];
  socket.emitClose();

  await expect(runPromise).rejects.toThrow("WebSocket connection closed");
  const sendLogs = infoSpy.mock.calls.filter(
    ([prefix, event]) => prefix === "[session_socket]" && event === "send"
  );
  expect(sendLogs).toEqual([
    [
      "[session_socket]",
      "send",
      expect.objectContaining({
        bytesBase64Length: 8,
        mimeType: "audio/webm",
        sequence: 2,
        size: 1280,
        type: "audio.chunk",
      }),
    ],
    [
      "[session_socket]",
      "send",
      expect.objectContaining({
        gradeBand: "6-8",
        subject: "math",
        textLength: 14,
        type: "speech.end",
      }),
    ],
  ]);
  expect(warnSpy).toHaveBeenCalledWith(
    "[session_socket]",
    "close",
    expect.objectContaining({
      code: undefined,
      reason: "",
      wasClean: false,
    })
  );
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

test("session transport refuses websocket connect before firebase auth is ready", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
  getFirebaseAuthClient.mockReturnValue({ currentUser: null });
  getCurrentFirebaseIdToken.mockResolvedValue(null);

  await expect(createSessionSocketTransport().connect()).resolves.toBe("failed");
  expect(FakeWebSocket.instances).toHaveLength(0);
});

test("session transport appends firebase auth token to websocket url when available", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
  getFirebaseAuthClient.mockReturnValue({ currentUser: { uid: "user-1" } });
  getCurrentFirebaseIdToken.mockResolvedValue("firebase-id-token");

  await expect(createSessionSocketTransport().connect()).resolves.toBe("connected");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(FakeWebSocket.instances[0]?.url).toContain("auth_token=firebase-id-token");
});

test("session transport logs a single warning when websocket connect fails before open", async () => {
  class ErrorWebSocket {
    static OPEN = 1;

    readonly sent: string[] = [];
    readonly url: string;
    readyState = 3;
    onopen: (() => void) | null = null;
    onmessage: ((event: MessageEvent<string>) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: ((event?: CloseEvent) => void) | null = null;

    constructor(url: string) {
      this.url = url;
      queueMicrotask(() => {
        this.onerror?.();
        this.onclose?.({ code: 1006, reason: "", wasClean: false } as CloseEvent);
      });
    }

    send(payload: string) {
      this.sent.push(payload);
    }
  }

  vi.stubGlobal("WebSocket", ErrorWebSocket as unknown as typeof WebSocket);
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  await expect(createSessionSocketTransport().connect()).resolves.toBe("failed");

  expect(warnSpy.mock.calls).toEqual([
    [
      "[session_socket]",
      "connect.failed",
      expect.objectContaining({
        readyState: 3,
      }),
    ],
  ]);
  expect(errorSpy).not.toHaveBeenCalled();
});

test("session transport rejects runTurn when websocket connect fails before open", async () => {
  class ErrorWebSocket {
    static OPEN = 1;

    readonly sent: string[] = [];
    readonly url: string;
    readyState = 3;
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

  const transport = createSessionSocketTransport();

  await expect(
    transport.runTurn({
      studentText: "1+1",
      subject: "math",
      gradeBand: "6-8",
    })
  ).rejects.toThrow("WebSocket connection failed");
});

test("session transport times out a hung turn", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const transport = createSessionSocketTransport();
  const runPromise = transport.runTurn({
    studentText: "",
    subject: "math",
    gradeBand: "6-8",
    audioChunks: [{ sequence: 1, size: 3, bytesBase64: "YWJj", mimeType: "audio/webm;codecs=opus" }],
  });
  runPromise.catch(() => {});

  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(15_000);

  await expect(runPromise).rejects.toThrow("Tutor turn timed out during speech transcription");
  expect(warnSpy).toHaveBeenCalledWith(
    "[session_socket]",
    "turn.timeout",
    expect.objectContaining({
      phase: "stt",
      timeoutMs: 15000,
    })
  );
});

test("session transport reports llm timeout after transcript final arrives", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  const runPromise = transport.runTurn({
    studentText: "",
    subject: "math",
    gradeBand: "6-8",
    audioChunks: [{ sequence: 1, size: 3, bytesBase64: "YWJj", mimeType: "audio/webm;codecs=opus" }],
  });
  runPromise.catch(() => {});

  await vi.advanceTimersByTimeAsync(0);
  FakeWebSocket.instances[0]?.emit({ type: "transcript.final", text: "2+2" });
  await vi.advanceTimersByTimeAsync(15_000);

  await expect(runPromise).rejects.toThrow("Tutor turn timed out during tutor response generation");
});

test("session transport reports tts timeout after tutor text starts streaming", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  const runPromise = transport.runTurn({
    studentText: "",
    subject: "math",
    gradeBand: "6-8",
    audioChunks: [{ sequence: 1, size: 3, bytesBase64: "YWJj", mimeType: "audio/webm;codecs=opus" }],
  });
  runPromise.catch(() => {});

  await vi.advanceTimersByTimeAsync(0);
  const socket = FakeWebSocket.instances[0];
  socket?.emit({ type: "transcript.final", text: "2+2" });
  socket?.emit({ type: "tutor.text.committed", text: "Start here." });
  await vi.advanceTimersByTimeAsync(15_000);

  await expect(runPromise).rejects.toThrow("Tutor turn timed out during speech synthesis");
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

test("session transport can transcribe audio without starting a tutor reply", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const updates: string[] = [];
  const transport = createSessionSocketTransport();
  const transcribePromise = transport.transcribeAudio?.({
    studentText: "",
    subject: "math",
    gradeBand: "6-8",
    audioChunks: [{ sequence: 1, size: 320, bytesBase64: "YWJj", mimeType: "audio/webm" }],
    onTranscriptUpdate(text) {
      updates.push(text);
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];
  const sentPayloads = socket.sent.map((payload) => JSON.parse(payload) as Record<string, unknown>);

  expect(sentPayloads[0]).toMatchObject({ type: "audio.chunk" });
  expect(sentPayloads[1]).toMatchObject({
    type: "speech.end",
    transcribe_only: true,
  });

  socket.emit({ type: "transcript.partial_stable", text: "2 plus" });
  socket.emit({ type: "transcript.final", text: "2 plus 2" });

  await expect(transcribePromise).resolves.toBe("2 plus 2");
  expect(updates).toEqual(["2 plus", "2 plus 2"]);
});

test("session transport combines multi-chunk browser audio before transcription", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  const transcribePromise = transport.transcribeAudio?.({
    studentText: "",
    subject: "math",
    gradeBand: "6-8",
    audioChunks: [
      { sequence: 1, size: 3, bytesBase64: "YWJj", mimeType: "audio/webm;codecs=opus" },
      { sequence: 2, size: 2, bytesBase64: "ZGU=", mimeType: "audio/webm;codecs=opus" },
    ],
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];
  const sentPayloads = socket.sent.map((payload) => JSON.parse(payload) as Record<string, unknown>);

  expect(sentPayloads[0]).toMatchObject({
    type: "audio.chunk",
    sequence: 1,
    size: 5,
    mime_type: "audio/webm;codecs=opus",
    bytes_b64: "YWJjZGU=",
  });
  expect(sentPayloads[1]).toMatchObject({
    type: "speech.end",
    transcribe_only: true,
  });

  socket.emit({ type: "transcript.final", text: "abcde" });
  await expect(transcribePromise).resolves.toBe("abcde");
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

test("session transport preserves a conversational multi-chunk tutor reply", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  const runPromise = transport.runTurn({
    studentText: "please help me solve it",
    subject: "math",
    gradeBand: "6-8",
    audioChunks: [],
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];

  socket.emit({ type: "transcript.final", text: "please help me solve it" });
  socket.emit({ type: "state.changed", state: "speaking" });
  socket.emit({ type: "tutor.text.committed", text: "Great," });
  socket.emit({
    type: "tts.audio",
    audio_b64: "YQ==",
    audio_mime_type: "audio/wav",
    is_final: false,
    timestamps: [{ word: "Great", start_ms: 0, end_ms: 90 }],
  });
  socket.emit({
    type: "tutor.text.committed",
    text: "let's go step by step. What do you get if you start with 2 and add 2?",
  });
  socket.emit({
    type: "tts.audio",
    audio_b64: "Yg==",
    audio_mime_type: "audio/wav",
    is_final: true,
    timestamps: [{ word: "let's", start_ms: 0, end_ms: 120 }],
  });

  await expect(runPromise).resolves.toMatchObject({
    transcript: "please help me solve it",
    tutorText: "Great, let's go step by step. What do you get if you start with 2 and add 2?",
    audioSegments: [
      { text: "Great," },
      { text: "let's go step by step. What do you get if you start with 2 and add 2?" },
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
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    preference: "slow down",
    sessionId: "lesson-42",
    studentPrompt: "saved question",
    subject: "math",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
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
