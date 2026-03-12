import { afterEach, vi } from "vitest";

const { getCurrentFirebaseIdToken } = vi.hoisted(() => ({
  getCurrentFirebaseIdToken: vi.fn<() => Promise<string | null>>(),
}));

const { getFirebaseAuthClient } = vi.hoisted(() => ({
  getFirebaseAuthClient: vi.fn<() => { currentUser?: unknown } | null>(),
}));

vi.mock("./firebase_auth", () => ({
  getCurrentFirebaseIdToken,
}));

vi.mock("./firebase_client", () => ({
  getFirebaseAuthClient,
}));

import { createOpenAIRealtimeTransport } from "./openai_realtime_transport";

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readonly sent: string[] = [];
  readonly url: string;
  readonly protocols: string[];
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string, protocols: string[]) {
    this.url = url;
    this.protocols = protocols;
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

  close() {
    this.onclose?.();
  }
}

class FakeAudioContext {
  async decodeAudioData() {
    return {
      numberOfChannels: 1,
      sampleRate: 24_000,
      duration: 0,
      length: 2,
      getChannelData() {
        return new Float32Array([0.25, -0.25]);
      },
      copyFromChannel() {
        return;
      },
      copyToChannel() {
        return;
      },
    } as unknown as AudioBuffer;
  }

  async close() {
    return;
  }
}

class FakeBlob {
  readonly type: string;

  constructor(_parts: unknown[], options?: { type?: string }) {
    this.type = options?.type ?? "";
  }

  async arrayBuffer() {
    return new ArrayBuffer(8);
  }
}

afterEach(() => {
  FakeWebSocket.instances = [];
  getCurrentFirebaseIdToken.mockReset();
  getCurrentFirebaseIdToken.mockResolvedValue(null);
  getFirebaseAuthClient.mockReset();
  getFirebaseAuthClient.mockReturnValue(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("openai realtime transport mints a client secret and resolves a text turn with wav audio", async () => {
  getCurrentFirebaseIdToken.mockResolvedValue("firebase-id-token");
  const fetchImpl = vi.fn(async () => ({
    ok: true,
    async json() {
      return { client_secret: { value: "ephemeral-123" } };
    },
  })) as unknown as typeof fetch;

  const transport = createOpenAIRealtimeTransport({
    apiUrl: "http://127.0.0.1:8000/api/realtime/client-secret",
    fetchImpl,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  });

  const runPromise = transport.runTurn({
    studentText: "What is 6 times 7?",
    subject: "math",
    gradeBand: "6-8",
    llmProvider: "openai-realtime",
    llmModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];
  expect(socket).toBeDefined();
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(fetchImpl).toHaveBeenCalledWith(
    "http://127.0.0.1:8000/api/realtime/client-secret",
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer firebase-id-token",
        "Content-Type": "application/json",
      }),
    })
  );
  expect(socket.protocols).toEqual(["realtime", "openai-insecure-api-key.ephemeral-123"]);

  const sentPayloads = socket.sent.map((payload) => JSON.parse(payload) as Record<string, unknown>);
  expect(sentPayloads[0]).toMatchObject({ type: "session.update" });
  expect(sentPayloads[0]).toMatchObject({
    session: {
      output_modalities: ["audio"],
    },
  });
  expect(sentPayloads[1]).toMatchObject({
    type: "conversation.item.create",
    item: {
      role: "user",
      type: "message",
      content: [{ type: "input_text", text: "What is 6 times 7?" }],
    },
  });
  expect(sentPayloads[2]).toMatchObject({
    type: "response.create",
    response: { output_modalities: ["audio"] },
  });

  socket.emit({ type: "response.text.delta", delta: "It is 42." });
  socket.emit({ type: "response.audio.delta", delta: "AAA=" });
  socket.emit({ type: "response.audio.done" });
  socket.emit({ type: "response.done" });

  await expect(runPromise).resolves.toMatchObject({
    transcript: "What is 6 times 7?",
    tutorText: "It is 42.",
    audioSegments: [
      {
        text: "It is 42.",
        audioMimeType: "audio/wav",
      },
    ],
  });
});

test("openai realtime transport accepts the live backend top-level value shape", async () => {
  getCurrentFirebaseIdToken.mockResolvedValue("firebase-id-token");
  const fetchImpl = vi.fn(async () => ({
    ok: true,
    async json() {
      return { value: "ephemeral-top-level-123" };
    },
  })) as unknown as typeof fetch;

  const transport = createOpenAIRealtimeTransport({
    apiUrl: "http://127.0.0.1:8000/api/realtime/client-secret",
    fetchImpl,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  });

  const runPromise = transport.runTurn({
    studentText: "What is 6 times 7?",
    subject: "math",
    gradeBand: "6-8",
    llmProvider: "openai-realtime",
    llmModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];
  expect(socket).toBeDefined();
  expect(socket.protocols).toEqual(["realtime", "openai-insecure-api-key.ephemeral-top-level-123"]);

  socket.emit({ type: "response.text.delta", delta: "It is 42." });
  socket.emit({ type: "response.audio.delta", delta: "AAA=" });
  socket.emit({ type: "response.audio.done" });
  socket.emit({ type: "response.done" });

  await expect(runPromise).resolves.toMatchObject({
    transcript: "What is 6 times 7?",
    tutorText: "It is 42.",
  });
});

test("openai realtime transport waits for provider audio completion before resolving", async () => {
  getCurrentFirebaseIdToken.mockResolvedValue("firebase-id-token");
  const fetchImpl = vi.fn(async () => ({
    ok: true,
    async json() {
      return { client_secret: { value: "ephemeral-123" } };
    },
  })) as unknown as typeof fetch;

  const transport = createOpenAIRealtimeTransport({
    apiUrl: "http://127.0.0.1:8000/api/realtime/client-secret",
    fetchImpl,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  });

  const runPromise = transport.runTurn({
    studentText: "What is 6 times 7?",
    subject: "math",
    gradeBand: "6-8",
    llmProvider: "openai-realtime",
    llmModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
  });

  let resolved = false;
  void runPromise.then(() => {
    resolved = true;
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];

  socket.emit({ type: "response.text.delta", delta: "Hi there! What would you like to explore in math today?" });
  socket.emit({ type: "response.done" });
  await Promise.resolve();
  expect(resolved).toBe(false);

  socket.emit({ type: "response.audio.delta", delta: "AAA=" });
  socket.emit({ type: "response.output_audio.done" });

  await expect(runPromise).resolves.toMatchObject({
    tutorText: "Hi there! What would you like to explore in math today?",
    audioSegments: [
      expect.objectContaining({
        audioMimeType: "audio/wav",
      }),
    ],
  });
});

test("openai realtime transport surfaces backend token route detail", async () => {
  getCurrentFirebaseIdToken.mockResolvedValue("firebase-id-token");
  const fetchImpl = vi.fn(async () => ({
    ok: false,
    status: 503,
    async text() {
      return JSON.stringify({ detail: "OPENAI_API_KEY is required for OpenAI Realtime" });
    },
  })) as unknown as typeof fetch;

  const transport = createOpenAIRealtimeTransport({
    apiUrl: "http://127.0.0.1:8000/api/realtime/client-secret",
    fetchImpl,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  });

  await expect(
    transport.runTurn({
      studentText: "Hello",
      subject: "math",
      gradeBand: "6-8",
      llmProvider: "openai-realtime",
      llmModel: "gpt-realtime-mini",
      ttsProvider: "openai-realtime",
      ttsModel: "gpt-realtime-mini",
    })
  ).rejects.toThrow("Realtime token request failed: OPENAI_API_KEY is required for OpenAI Realtime");
});

test("openai realtime transport surfaces backend token timeout detail", async () => {
  getCurrentFirebaseIdToken.mockResolvedValue("firebase-id-token");
  const fetchImpl = vi.fn(async () => ({
    ok: false,
    status: 504,
    async text() {
      return JSON.stringify({ detail: "OpenAI Realtime client secret request timed out" });
    },
  })) as unknown as typeof fetch;

  const transport = createOpenAIRealtimeTransport({
    apiUrl: "http://127.0.0.1:8000/api/realtime/client-secret",
    fetchImpl,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  });

  await expect(
    transport.runTurn({
      studentText: "Hello",
      subject: "math",
      gradeBand: "6-8",
      llmProvider: "openai-realtime",
      llmModel: "gpt-realtime-mini",
      ttsProvider: "openai-realtime",
      ttsModel: "gpt-realtime-mini",
    })
  ).rejects.toThrow("Realtime token request failed: OpenAI Realtime client secret request timed out");
});

test("openai realtime transport distinguishes token mint timeout before a backend response", async () => {
  getCurrentFirebaseIdToken.mockResolvedValue("firebase-id-token");
  const fetchImpl = vi.fn(async () => {
    const error = new Error("The operation timed out");
    error.name = "AbortError";
    throw error;
  }) as unknown as typeof fetch;

  const transport = createOpenAIRealtimeTransport({
    apiUrl: "http://127.0.0.1:8000/api/realtime/client-secret",
    fetchImpl,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  });

  await expect(
    transport.runTurn({
      studentText: "Hello",
      subject: "math",
      gradeBand: "6-8",
      llmProvider: "openai-realtime",
      llmModel: "gpt-realtime-mini",
      ttsProvider: "openai-realtime",
      ttsModel: "gpt-realtime-mini",
    })
  ).rejects.toThrow("Realtime token mint timed out before the backend responded");
});

test("openai realtime transport requires firebase sign-in before minting a realtime token", async () => {
  getFirebaseAuthClient.mockReturnValue({ currentUser: {} });
  const fetchImpl = vi.fn() as unknown as typeof fetch;

  const transport = createOpenAIRealtimeTransport({
    apiUrl: "http://127.0.0.1:8000/api/realtime/client-secret",
    fetchImpl,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  });

  await expect(
    transport.runTurn({
      studentText: "Hello",
      subject: "math",
      gradeBand: "6-8",
      llmProvider: "openai-realtime",
      llmModel: "gpt-realtime-mini",
      ttsProvider: "openai-realtime",
      ttsModel: "gpt-realtime-mini",
    })
  ).rejects.toThrow("Firebase sign-in required");
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("openai realtime transport uses a transcription session for mic-to-composer", async () => {
  getCurrentFirebaseIdToken.mockResolvedValue("firebase-id-token");
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("Blob", FakeBlob);

  const fetchSpy = vi.fn(async () => ({
    ok: true,
    async json() {
      return { client_secret: { value: "ephemeral-123" } };
    },
  }));
  const fetchImpl = fetchSpy as unknown as typeof fetch;

  const onTranscriptUpdate = vi.fn();
  const onTranscriptFinal = vi.fn();
  const transport = createOpenAIRealtimeTransport({
    apiUrl: "http://127.0.0.1:8000/api/realtime/client-secret",
    fetchImpl,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  });

  const runPromise = transport.transcribeAudio?.({
    studentText: "",
    subject: "math",
    gradeBand: "6-8",
    llmProvider: "openai-realtime",
    llmModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
    onTranscriptUpdate,
    onTranscriptFinal,
    audioChunks: [{ sequence: 1, size: 3, bytesBase64: "YWJj", mimeType: "audio/webm;codecs=opus" }],
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];
  expect(socket).toBeDefined();
  expect(socket.url).toBe("wss://api.openai.com/v1/realtime");

  const sentPayloads = socket.sent.map((payload) => JSON.parse(payload) as Record<string, unknown>);
  expect(sentPayloads).toHaveLength(3);
  const mintRequest = ((fetchSpy.mock.calls as unknown) as Array<[unknown, { body?: string } | undefined]>)[0]?.[1];
  expect(JSON.parse(mintRequest?.body ?? "{}")).toMatchObject({
    model: "gpt-4o-transcribe",
    session_type: "transcription",
    voice: "marin",
  });
  expect(sentPayloads[0]).toMatchObject({
    type: "session.update",
    session: {
      type: "transcription",
      audio: {
        input: {
          format: { type: "audio/pcm", rate: 24_000 },
          transcription: { model: "gpt-4o-transcribe" },
          turn_detection: null,
        },
      },
    },
  });
  expect(sentPayloads[1]).toMatchObject({ type: "input_audio_buffer.append" });
  expect(sentPayloads[2]).toMatchObject({ type: "input_audio_buffer.commit" });

  socket.emit({ type: "conversation.item.input_audio_transcription.delta", delta: "One" });
  socket.emit({ type: "conversation.item.input_audio_transcription.completed", transcript: "One plus one" });

  await expect(runPromise).resolves.toBe("One plus one");
  expect(onTranscriptUpdate).toHaveBeenCalledWith("One");
  expect(onTranscriptUpdate).toHaveBeenCalledWith("One plus one");
  expect(onTranscriptFinal).toHaveBeenCalledWith("One plus one");
});

test("openai realtime transport surfaces transcription websocket server errors", async () => {
  getCurrentFirebaseIdToken.mockResolvedValue("firebase-id-token");
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("Blob", FakeBlob);

  const fetchImpl = vi.fn(async () => ({
    ok: true,
    async json() {
      return { client_secret: { value: "ephemeral-123" } };
    },
  })) as unknown as typeof fetch;

  const transport = createOpenAIRealtimeTransport({
    apiUrl: "http://127.0.0.1:8000/api/realtime/client-secret",
    fetchImpl,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  });

  const runPromise = transport.transcribeAudio?.({
    studentText: "",
    subject: "math",
    gradeBand: "6-8",
    llmProvider: "openai-realtime",
    llmModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
    audioChunks: [{ sequence: 1, size: 3, bytesBase64: "YWJj", mimeType: "audio/webm;codecs=opus" }],
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = FakeWebSocket.instances[0];
  expect(socket).toBeDefined();

  socket.emit({
    type: "error",
    error: {
      message: "The server had an error while processing your request. Sorry about that!",
    },
  });

  await expect(runPromise).rejects.toThrow(
    "The server had an error while processing your request. Sorry about that!"
  );
});
