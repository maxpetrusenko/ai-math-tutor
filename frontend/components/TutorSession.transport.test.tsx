import { beforeEach, describe, expect, test, vi } from "vitest";

import { createConfiguredTransport, type TutorTurnRequest } from "./TutorSession";

const socketTransport = {
  connect: vi.fn(async () => "connected" as const),
  getSessionId: vi.fn(() => "socket-session"),
  interrupt: vi.fn(async () => undefined),
  reportMetric: vi.fn(async () => undefined),
  reset: vi.fn(async () => undefined),
  runTurn: vi.fn(),
  switchSession: vi.fn(async () => undefined),
  transcribeAudio: vi.fn(),
};

const openaiRealtimeTransport = {
  connect: vi.fn(async () => "connected" as const),
  getSessionId: vi.fn(() => "realtime-session"),
  interrupt: vi.fn(async () => undefined),
  reset: vi.fn(async () => undefined),
  runTurn: vi.fn(),
  switchSession: vi.fn(async () => undefined),
  transcribeAudio: vi.fn(),
};

vi.mock("../lib/session_socket", () => ({
  createSessionSocketTransport: () => socketTransport,
}));

vi.mock("../lib/openai_realtime_transport", () => ({
  createOpenAIRealtimeTransport: () => openaiRealtimeTransport,
}));

function buildRealtimeRequest(overrides: Partial<TutorTurnRequest> = {}): TutorTurnRequest {
  return {
    studentText: "",
    subject: "math",
    gradeBand: "6-8",
    llmProvider: "openai-realtime",
    llmModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
    audioChunks: [{ sequence: 1, size: 320, bytesBase64: "YWJj", mimeType: "audio/webm;codecs=opus" }],
    ...overrides,
  };
}

describe("createConfiguredTransport", () => {
  beforeEach(() => {
    socketTransport.connect.mockReset().mockResolvedValue("connected");
    socketTransport.getSessionId.mockReset().mockReturnValue("socket-session");
    socketTransport.interrupt.mockReset().mockResolvedValue(undefined);
    socketTransport.reportMetric.mockReset().mockResolvedValue(undefined);
    socketTransport.reset.mockReset().mockResolvedValue(undefined);
    socketTransport.runTurn.mockReset();
    socketTransport.switchSession.mockReset().mockResolvedValue(undefined);
    socketTransport.transcribeAudio.mockReset();

    openaiRealtimeTransport.connect.mockReset().mockResolvedValue("connected");
    openaiRealtimeTransport.getSessionId.mockReset().mockReturnValue("realtime-session");
    openaiRealtimeTransport.interrupt.mockReset().mockResolvedValue(undefined);
    openaiRealtimeTransport.reset.mockReset().mockResolvedValue(undefined);
    openaiRealtimeTransport.runTurn.mockReset();
    openaiRealtimeTransport.switchSession.mockReset().mockResolvedValue(undefined);
    openaiRealtimeTransport.transcribeAudio.mockReset();
  });

  test("prefers session socket transcription for mic capture even on realtime sessions", async () => {
    socketTransport.transcribeAudio.mockResolvedValueOnce("two plus two");
    openaiRealtimeTransport.transcribeAudio.mockResolvedValueOnce("joe blasto");

    const transport = createConfiguredTransport();
    await expect(transport.transcribeAudio?.(buildRealtimeRequest())).resolves.toBe("two plus two");

    expect(socketTransport.transcribeAudio).toHaveBeenCalledTimes(1);
    expect(openaiRealtimeTransport.transcribeAudio).not.toHaveBeenCalled();
  });

  test("falls back to realtime transcription when the socket transcription fails", async () => {
    socketTransport.transcribeAudio.mockRejectedValueOnce(new Error("backend stt unavailable"));
    openaiRealtimeTransport.transcribeAudio.mockResolvedValueOnce("two plus two");

    const transport = createConfiguredTransport();
    await expect(transport.transcribeAudio?.(buildRealtimeRequest())).resolves.toBe("two plus two");

    expect(socketTransport.transcribeAudio).toHaveBeenCalledTimes(1);
    expect(openaiRealtimeTransport.transcribeAudio).toHaveBeenCalledTimes(1);
  });

  test("still routes full turns to realtime for realtime sessions", async () => {
    openaiRealtimeTransport.runTurn.mockResolvedValueOnce({
      transcript: "2+2",
      tutorText: "Four.",
      state: "speaking",
      latency: {
        speechEndToSttFinalMs: 10,
        sttFinalToLlmFirstTokenMs: 20,
        llmFirstTokenToTtsFirstAudioMs: 30,
      },
      timestamps: [],
    });

    const transport = createConfiguredTransport();
    await expect(transport.runTurn(buildRealtimeRequest({ studentText: "2+2", audioChunks: [] }))).resolves.toMatchObject({
      tutorText: "Four.",
    });

    expect(openaiRealtimeTransport.runTurn).toHaveBeenCalledTimes(1);
    expect(socketTransport.runTurn).not.toHaveBeenCalled();
  });
});
