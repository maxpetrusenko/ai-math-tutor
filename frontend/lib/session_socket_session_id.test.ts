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
}

afterEach(() => {
  FakeWebSocket.instances = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("session transport replaces invalid session ids before opening the socket", async () => {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  const transport = createSessionSocketTransport();
  await transport.switchSession?.(undefined as unknown as string);
  await transport.connect();

  await new Promise((resolve) => setTimeout(resolve, 0));

  const socket = FakeWebSocket.instances[0];
  expect(socket).toBeDefined();
  expect(socket.url).not.toContain("session_id=undefined");
  expect(socket.url).toMatch(/session_id=/);
  expect(transport.getSessionId?.()).toBeTruthy();
  expect(transport.getSessionId?.()).not.toBe("undefined");
});
