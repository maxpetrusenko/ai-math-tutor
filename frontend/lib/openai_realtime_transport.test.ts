import { afterEach, vi } from "vitest";

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

afterEach(() => {
  FakeWebSocket.instances = [];
  vi.restoreAllMocks();
});

test("openai realtime transport mints a client secret and resolves a text turn with wav audio", async () => {
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
  expect(socket.protocols).toEqual(["realtime", "openai-insecure-api-key.ephemeral-123"]);

  const sentPayloads = socket.sent.map((payload) => JSON.parse(payload) as Record<string, unknown>);
  expect(sentPayloads[0]).toMatchObject({ type: "session.update" });
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
    response: { modalities: ["audio", "text"] },
  });

  socket.emit({ type: "response.text.delta", delta: "It is 42." });
  socket.emit({ type: "response.audio.delta", delta: "AAA=" });
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
