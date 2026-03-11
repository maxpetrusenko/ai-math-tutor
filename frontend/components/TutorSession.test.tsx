import React from "react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { TutorSession } from "./TutorSession";
import { BrowserAudioCapture } from "../lib/audio_capture";
import {
  clearPersistedLessonThread,
  persistArchivedLessonThread,
  writePersistedLessonThread,
} from "../lib/lesson_thread_store";

vi.mock("./Avatar3D", () => ({
  Avatar3D: () => <div>Avatar (3D)</div>,
}));

afterEach(() => {
  clearPersistedLessonThread();
  window.localStorage.clear();
  document.cookie = "nerdy_avatar_provider=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  vi.restoreAllMocks();
});

function createDeferredTurn() {
  let resolve!: (value: {
    transcript: string;
    tutorText: string;
    state: string;
    latency: {
      speechEndToSttFinalMs: number;
      sttFinalToLlmFirstTokenMs: number;
      llmFirstTokenToTtsFirstAudioMs: number;
    };
    timestamps: Array<{ word: string; startMs: number; endMs: number }>;
    avatarConfig?: { provider: string; type: "2d" | "3d"; model_url?: string };
  }) => void;

  const promise = new Promise<{
    transcript: string;
    tutorText: string;
    state: string;
    latency: {
      speechEndToSttFinalMs: number;
      sttFinalToLlmFirstTokenMs: number;
      llmFirstTokenToTtsFirstAudioMs: number;
    };
    timestamps: Array<{ word: string; startMs: number; endMs: number }>;
    avatarConfig?: { provider: string; type: "2d" | "3d"; model_url?: string };
  }>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}


test("renders session shell and runs a tutoring turn", async () => {
  const requests: Array<Record<string, unknown>> = [];

  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn(request) {
          requests.push(request as Record<string, unknown>);
          return {
            transcript: String((request as Record<string, unknown>).studentText),
            tutorText: "Nice start. What should you isolate first?",
            state: "speaking",
            latency: {
              speechEndToSttFinalMs: 120,
              sttFinalToLlmFirstTokenMs: 140,
              llmFirstTokenToTtsFirstAudioMs: 110
            },
            timestamps: [{ word: "Nice", startMs: 0, endMs: 100 }]
          };
        },
        interrupt() {
          return Promise.resolve();
        },
        reset() {
          return Promise.resolve();
        }
      }}
    />
  );

  expect(screen.getByText("Lesson")).toBeInTheDocument();
  expect(screen.getByTestId("latency-strip")).toBeInTheDocument();
  expect(screen.getByLabelText("Student prompt")).toBeInTheDocument();
  expect(screen.getByLabelText("Subject")).toBeInTheDocument();
  expect(screen.getByLabelText("Grade band")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "I don't understand how to solve for x." }
  });
  fireEvent.change(screen.getByLabelText("Subject"), {
    target: { value: "science" }
  });
  fireEvent.change(screen.getByLabelText("Grade band"), {
    target: { value: "9-10" }
  });
  fireEvent.change(screen.getByLabelText("LLM provider"), {
    target: { value: "minimax" }
  });
  fireEvent.change(screen.getByLabelText("TTS provider"), {
    target: { value: "minimax" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() =>
    expect(screen.getAllByText("Nice start. What should you isolate first?").length).toBeGreaterThan(0)
  );
  expect(screen.getByText("STT 120 ms")).toBeInTheDocument();
  expect(screen.getByTestId("avatar-subtitle")).toHaveTextContent("Nice start. What should you isolate first?");
  expect(requests[0]).toMatchObject({
    studentText: "I don't understand how to solve for x.",
    subject: "science",
    gradeBand: "9-10",
    llmProvider: "minimax",
    llmModel: "minimax-m2.5",
    ttsProvider: "minimax",
    ttsModel: "minimax-speech",
  });
});

test("hold-to-talk mic transcribes on release and waits for explicit send for the openai combo", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const transcriptions: Array<Record<string, unknown>> = [];
  const startSpy = vi.spyOn(BrowserAudioCapture.prototype, "start").mockResolvedValue();
  const stopSpy = vi
    .spyOn(BrowserAudioCapture.prototype, "stop")
    .mockResolvedValue([{ sequence: 1, size: 320, bytesBase64: "YWJj" }]);
  vi.spyOn(BrowserAudioCapture.prototype, "isSupported").mockReturnValue(true);

  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async transcribeAudio(request) {
          transcriptions.push(request as Record<string, unknown>);
          request.onTranscriptUpdate?.("voice transcript");
          return "voice transcript";
        },
        async runTurn(request) {
          requests.push(request as Record<string, unknown>);
          request.onTranscriptFinal?.("voice transcript");
          return {
            transcript: "voice transcript",
            tutorText: "Voice tutor reply",
            state: "speaking",
            latency: {
              speechEndToSttFinalMs: 100,
              sttFinalToLlmFirstTokenMs: 110,
              llmFirstTokenToTtsFirstAudioMs: 120,
            },
            timestamps: [{ word: "Voice", startMs: 0, endMs: 100 }],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  const micButton = screen.getByRole("button", { name: "Hold to talk" });
  fireEvent.mouseDown(micButton, { button: 0 });
  fireEvent.pointerDown(micButton, { button: 0, pointerId: 1 });

  await waitFor(() => expect(startSpy).toHaveBeenCalledTimes(1));
  const activeMicButton = screen.getByRole("button", { name: /Hold to talk|Release to send/ });
  fireEvent.pointerUp(activeMicButton, { button: 0, pointerId: 1 });
  fireEvent.mouseUp(activeMicButton, { button: 0 });

  await waitFor(() => expect(stopSpy).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(transcriptions).toHaveLength(1));
  expect(transcriptions[0]).toMatchObject({
    audioChunks: [{ sequence: 1, size: 320, bytesBase64: "YWJj" }],
    llmProvider: "openai-realtime",
    ttsProvider: "openai-realtime",
  });
  expect(screen.getByLabelText("Student prompt")).toHaveValue("voice transcript");

  expect(requests).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0]).toMatchObject({
    llmProvider: "openai-realtime",
    llmModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
  });
  await waitFor(() => expect(screen.getAllByText("Voice tutor reply").length).toBeGreaterThan(0));
});

test("hold-to-talk mic transcribes on release and waits for explicit send for socket combos", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const transcriptions: Array<Record<string, unknown>> = [];
  const startSpy = vi.spyOn(BrowserAudioCapture.prototype, "start").mockResolvedValue();
  const stopSpy = vi
    .spyOn(BrowserAudioCapture.prototype, "stop")
    .mockResolvedValue([{ sequence: 1, size: 320, bytesBase64: "YWJj" }]);
  vi.spyOn(BrowserAudioCapture.prototype, "isSupported").mockReturnValue(true);

  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async transcribeAudio(request) {
          transcriptions.push(request as Record<string, unknown>);
          request.onTranscriptUpdate?.("voice transcript");
          return "voice transcript";
        },
        async runTurn(request) {
          requests.push(request as Record<string, unknown>);
          return {
            transcript: "voice transcript",
            tutorText: "Voice tutor reply",
            state: "speaking",
            latency: {
              speechEndToSttFinalMs: 100,
              sttFinalToLlmFirstTokenMs: 110,
              llmFirstTokenToTtsFirstAudioMs: 120,
            },
            timestamps: [{ word: "Voice", startMs: 0, endMs: 100 }],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  await waitFor(() => expect(screen.getByLabelText("TTS provider")).toHaveValue("openai-realtime"));
  fireEvent.change(screen.getByLabelText("TTS provider"), {
    target: { value: "cartesia" },
  });
  await waitFor(() => expect(screen.getByLabelText("LLM provider")).toHaveValue("openai"));
  await waitFor(() => expect(screen.getByLabelText("TTS provider")).toHaveValue("cartesia"));

  const micButton = screen.getByRole("button", { name: "Hold to talk" });
  fireEvent.mouseDown(micButton, { button: 0 });
  fireEvent.pointerDown(micButton, { button: 0, pointerId: 1 });

  await waitFor(() => expect(startSpy).toHaveBeenCalledTimes(1));
  const activeMicButton = screen.getByRole("button", { name: /Hold to talk|Release to send/ });
  fireEvent.pointerUp(activeMicButton, { button: 0, pointerId: 1 });
  fireEvent.mouseUp(activeMicButton, { button: 0 });

  await waitFor(() => expect(stopSpy).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(transcriptions).toHaveLength(1));
  expect(transcriptions[0]).toMatchObject({
    audioChunks: [{ sequence: 1, size: 320, bytesBase64: "YWJj" }],
    llmProvider: "openai",
    ttsProvider: "cartesia",
  });
  expect(screen.getByLabelText("Student prompt")).toHaveValue("voice transcript");
  expect(requests).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(requests).toHaveLength(1));
  await waitFor(() => expect(screen.getAllByText("Voice tutor reply").length).toBeGreaterThan(0));
});

test("selecting realtime on either provider couples both providers and models", async () => {
  const requests: Array<Record<string, unknown>> = [];

  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn(request) {
          requests.push(request as Record<string, unknown>);
          return {
            transcript: "Realtime prompt",
            tutorText: "Realtime reply",
            state: "speaking",
            latency: {
              speechEndToSttFinalMs: 10,
              sttFinalToLlmFirstTokenMs: 20,
              llmFirstTokenToTtsFirstAudioMs: 30,
            },
            timestamps: [],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  fireEvent.change(screen.getByLabelText("TTS provider"), {
    target: { value: "openai-realtime" },
  });

  await waitFor(() => expect(screen.getByLabelText("LLM provider")).toHaveValue("openai-realtime"));
  expect(screen.getByLabelText("LLM model")).toHaveValue("gpt-realtime-mini");
  expect(screen.getByLabelText("TTS provider")).toHaveValue("openai-realtime");
  expect(screen.getByLabelText("TTS model")).toHaveValue("gpt-realtime-mini");

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "Say hi" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0]).toMatchObject({
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
  });
});

test("switching llm away from realtime restores a normal llm plus cartesia pair", async () => {
  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn() {
          return {
            transcript: "",
            tutorText: "",
            state: "idle",
            latency: {
              speechEndToSttFinalMs: 0,
              sttFinalToLlmFirstTokenMs: 0,
              llmFirstTokenToTtsFirstAudioMs: 0,
            },
            timestamps: [],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  fireEvent.change(screen.getByLabelText("TTS provider"), {
    target: { value: "openai-realtime" },
  });

  await waitFor(() => expect(screen.getByLabelText("LLM provider")).toHaveValue("openai-realtime"));

  fireEvent.change(screen.getByLabelText("LLM provider"), {
    target: { value: "gemini" },
  });

  await waitFor(() => expect(screen.getByLabelText("LLM provider")).toHaveValue("gemini"));
  expect(screen.getByLabelText("LLM model")).toHaveValue("gemini-3-flash-preview");
  expect(screen.getByLabelText("TTS provider")).toHaveValue("cartesia");
  expect(screen.getByLabelText("TTS model")).toHaveValue("sonic-2");
});

test("fresh lesson defaults to the openai realtime combo", async () => {
  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn() {
          return {
            transcript: "",
            tutorText: "",
            state: "idle",
            latency: {
              speechEndToSttFinalMs: 0,
              sttFinalToLlmFirstTokenMs: 0,
              llmFirstTokenToTtsFirstAudioMs: 0,
            },
            timestamps: [],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  await waitFor(() => expect(screen.getByLabelText("LLM provider")).toHaveValue("openai-realtime"));
  expect(screen.getByLabelText("LLM model")).toHaveValue("gpt-realtime-mini");
  expect(screen.getByLabelText("TTS provider")).toHaveValue("openai-realtime");
  expect(screen.getByLabelText("TTS model")).toHaveValue("gpt-realtime-mini");
});

test("mic transcription receives the active runtime selection for socket combos", async () => {
  vi.spyOn(BrowserAudioCapture.prototype, "isSupported").mockReturnValue(true);
  vi.spyOn(BrowserAudioCapture.prototype, "start").mockResolvedValue();
  vi.spyOn(BrowserAudioCapture.prototype, "stop").mockResolvedValue([
    { sequence: 1, size: 320, bytesBase64: "YWJj", mimeType: "audio/webm" },
  ]);
  writePersistedLessonThread({
    avatarProviderId: "human-css-2d",
    conversation: [],
    gradeBand: "6-8",
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    preference: "",
    sessionId: "lesson-socket-mic",
    studentPrompt: "",
    subject: "math",
    transcript: "",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
    tutorText: "",
    version: 1,
  });

  const transcribeRequests: Array<Record<string, unknown>> = [];

  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async transcribeAudio(request) {
          transcribeRequests.push(request as Record<string, unknown>);
          return "2+2";
        },
        async runTurn() {
          return {
            transcript: "",
            tutorText: "",
            state: "idle",
            latency: {
              speechEndToSttFinalMs: 0,
              sttFinalToLlmFirstTokenMs: 0,
              llmFirstTokenToTtsFirstAudioMs: 0,
            },
            timestamps: [],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  await waitFor(() => expect(screen.getByLabelText("LLM provider")).toHaveValue("gemini"));
  await waitFor(() => expect(screen.getByLabelText("TTS provider")).toHaveValue("cartesia"));
  const micButton = screen.getByRole("button", { name: "Hold to talk" });
  fireEvent.mouseDown(micButton, { button: 0 });
  fireEvent.pointerDown(micButton, { button: 0, pointerId: 1 });
  const activeMicButton = await screen.findByRole("button", { name: /Hold to talk|Release to send/ });
  fireEvent.pointerUp(activeMicButton, { button: 0, pointerId: 1 });
  fireEvent.mouseUp(activeMicButton, { button: 0 });

  await waitFor(() => expect(transcribeRequests).toHaveLength(1));
  expect(transcribeRequests[0]).toMatchObject({
    llmProvider: "gemini",
    llmModel: "gemini-3-flash-preview",
    ttsProvider: "cartesia",
    ttsModel: "sonic-2",
  });
});

test("mic stays enabled after an empty capture error", async () => {
  vi.spyOn(BrowserAudioCapture.prototype, "isSupported").mockReturnValue(true);
  vi.spyOn(BrowserAudioCapture.prototype, "start").mockResolvedValue();
  vi.spyOn(BrowserAudioCapture.prototype, "stop").mockResolvedValue([
    { sequence: 1, size: 320, bytesBase64: "YWJj" },
  ]);

  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async transcribeAudio() {
          throw new Error("No speech detected");
        },
        async runTurn() {
          throw new Error("runTurn should not be called for mic transcription errors");
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  await waitFor(() => expect(screen.getByLabelText("TTS provider")).toHaveValue("openai-realtime"));
  fireEvent.change(screen.getByLabelText("TTS provider"), {
    target: { value: "cartesia" },
  });
  await waitFor(() => expect(screen.getByLabelText("LLM provider")).toHaveValue("openai"));
  await waitFor(() => expect(screen.getByLabelText("TTS provider")).toHaveValue("cartesia"));

  const micButton = screen.getByRole("button", { name: "Hold to talk" });
  fireEvent.mouseDown(micButton, { button: 0 });
  fireEvent.pointerDown(micButton, { button: 0, pointerId: 1 });
  fireEvent.pointerUp(micButton, { button: 0, pointerId: 1 });
  fireEvent.mouseUp(micButton, { button: 0 });

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No speech detected"));
  expect(screen.getByRole("button", { name: "Hold to talk" })).not.toBeDisabled();
});

test("avatar provider controls switch between 2d and 3d views", async () => {
  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn() {
          return {
            transcript: "",
            tutorText: "",
            state: "idle",
            latency: {
              speechEndToSttFinalMs: 0,
              sttFinalToLlmFirstTokenMs: 0,
              llmFirstTokenToTtsFirstAudioMs: 0
            },
            timestamps: []
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        }
      }}
    />
  );

  expect(screen.getByTestId("avatar-surface-2d")).toBeInTheDocument();
  expect(screen.getByLabelText("Render mode")).toHaveValue("2d");
  expect(screen.getByLabelText("Avatar")).toHaveValue("human-css-2d");
  expect(screen.getByRole("option", { name: "Human" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Human 3D" })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Render mode"), {
    target: { value: "3d" },
  });
  fireEvent.change(screen.getByLabelText("Avatar"), {
    target: { value: "human-threejs-3d" },
  });

  await waitFor(() => expect(screen.getByTestId("avatar-surface-3d")).toBeInTheDocument());
  expect(screen.getByLabelText("Render mode")).toHaveValue("3d");
  expect(screen.getByLabelText("Avatar")).toHaveValue("human-threejs-3d");
  expect(screen.getByText("Avatar (3D)")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Render mode"), {
    target: { value: "2d" },
  });
  fireEvent.change(screen.getByLabelText("Avatar"), {
    target: { value: "banana-css-2d" },
  });

  await waitFor(() => expect(screen.getByTestId("avatar-surface-2d")).toBeInTheDocument());
  expect(screen.getByLabelText("Render mode")).toHaveValue("2d");
  expect(screen.getByLabelText("Avatar")).toHaveValue("banana-css-2d");
  expect(screen.getByTestId("avatar-surface-2d")).toBeInTheDocument();
});

test("renders the preloaded avatar selection on first paint", async () => {
  render(
    <TutorSession
      initialAvatarProviderId="human-threejs-3d"
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn() {
          return {
            transcript: "",
            tutorText: "",
            state: "idle",
            latency: {
              speechEndToSttFinalMs: 0,
              sttFinalToLlmFirstTokenMs: 0,
              llmFirstTokenToTtsFirstAudioMs: 0,
            },
            timestamps: [],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  await waitFor(() => expect(screen.getByText("connected")).toBeInTheDocument());
  expect(screen.getByTestId("avatar-surface-3d")).toBeInTheDocument();
  expect(screen.getByLabelText("Render mode")).toHaveValue("3d");
  expect(screen.getByLabelText("Avatar")).toHaveValue("human-threejs-3d");
});

test("persists the selected avatar preference for the next app load", async () => {
  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn() {
          return {
            transcript: "",
            tutorText: "",
            state: "idle",
            latency: {
              speechEndToSttFinalMs: 0,
              sttFinalToLlmFirstTokenMs: 0,
              llmFirstTokenToTtsFirstAudioMs: 0,
            },
            timestamps: [],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  fireEvent.change(screen.getByLabelText("Render mode"), {
    target: { value: "3d" },
  });
  fireEvent.change(screen.getByLabelText("Avatar"), {
    target: { value: "human-threejs-3d" },
  });

  await waitFor(() => expect(screen.getByLabelText("Avatar")).toHaveValue("human-threejs-3d"));
  expect(document.cookie).toContain("nerdy_avatar_provider=human-threejs-3d");
});

test("does not trigger a hydration mismatch when browser mic support is available", async () => {
  const transport = {
    async connect() {
      return "connected" as const;
    },
    async runTurn() {
      return {
        transcript: "",
        tutorText: "",
        state: "idle",
        latency: {
          speechEndToSttFinalMs: 0,
          sttFinalToLlmFirstTokenMs: 0,
          llmFirstTokenToTtsFirstAudioMs: 0
        },
        timestamps: []
      };
    },
    async interrupt() {
      return;
    },
    async reset() {
      return;
    }
  };

  const originalIsSupported = BrowserAudioCapture.prototype.isSupported;
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    BrowserAudioCapture.prototype.isSupported = () => false;
    const html = renderToString(<TutorSession transport={transport} />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    BrowserAudioCapture.prototype.isSupported = () => true;

    await act(async () => {
      hydrateRoot(container, <TutorSession transport={transport} />);
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
  } finally {
    BrowserAudioCapture.prototype.isSupported = originalIsSupported;
    consoleError.mockRestore();
    document.body.innerHTML = "";
  }
});

test("does not trigger a hydration mismatch when archived lessons exist only on the client", async () => {
  const transport = {
    async connect() {
      return "connected" as const;
    },
    async runTurn() {
      return {
        transcript: "",
        tutorText: "",
        state: "idle",
        latency: {
          speechEndToSttFinalMs: 0,
          sttFinalToLlmFirstTokenMs: 0,
          llmFirstTokenToTtsFirstAudioMs: 0,
        },
        timestamps: [],
      };
    },
    async interrupt() {
      return;
    },
    async reset() {
      return;
    },
  };

  await persistArchivedLessonThread({
    avatarProviderId: "robot-css-2d",
    conversation: [
      {
        id: "1",
        transcript: "saved transcript",
        tutorText: "saved tutor reply",
      },
    ],
    gradeBand: "9-10",
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    preference: "Use slower examples",
    sessionId: "lesson-saved-1",
    studentPrompt: "saved prompt",
    subject: "science",
    transcript: "saved transcript",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
    tutorText: "saved tutor reply",
    version: 1,
  });

  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const originalWindow = globalThis.window;

  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    });

    const html = renderToString(<TutorSession transport={transport} />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });

    await act(async () => {
      hydrateRoot(container, <TutorSession transport={transport} />);
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    consoleError.mockRestore();
    document.body.innerHTML = "";
  }
});

test("ignores stale tutor results after interrupt", async () => {
  const deferred = createDeferredTurn();
  const transport = {
    async connect() {
      return "connected" as const;
    },
    runTurn() {
      return deferred.promise;
    },
    async interrupt() {
      return;
    },
    async reset() {
      return;
    }
  };

  render(<TutorSession transport={transport} />);

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "interrupt me" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeDisabled());
  expect(screen.queryByRole("button", { name: "Interrupt" })).not.toBeInTheDocument();

  fireEvent.keyDown(window, { key: "Escape" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled());

  await act(async () => {
    deferred.resolve({
      transcript: "late transcript",
      tutorText: "Late tutor text",
      state: "speaking",
      latency: {
        speechEndToSttFinalMs: 120,
        sttFinalToLlmFirstTokenMs: 140,
        llmFirstTokenToTtsFirstAudioMs: 110
      },
      timestamps: [{ word: "Late", startMs: 0, endMs: 100 }]
    });
    await Promise.resolve();
  });

  expect(screen.queryByText("Late tutor text")).not.toBeInTheDocument();
  expect(screen.queryByText("late transcript")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled();
});

test("applies backend avatar provider config to the active avatar view", async () => {
  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn() {
          return {
            transcript: "student audio",
            tutorText: "Let us try a 3D avatar.",
            state: "speaking",
            latency: {
              speechEndToSttFinalMs: 120,
              sttFinalToLlmFirstTokenMs: 140,
              llmFirstTokenToTtsFirstAudioMs: 110
            },
            timestamps: [{ word: "Let", startMs: 0, endMs: 100 }],
            avatarConfig: {
              provider: "threejs",
              type: "3d"
            }
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        }
      }}
    />
  );

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "switch avatar" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getByTestId("avatar-surface-3d")).toBeInTheDocument());
  expect(screen.getByLabelText("Render mode")).toHaveValue("3d");
  expect(screen.getByLabelText("Avatar")).toHaveValue("human-threejs-3d");
});

test("send text turn appends conversation history and new lesson clears it", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const transport = {
    async connect() {
      return "connected" as const;
    },
    async runTurn(request: Record<string, unknown>) {
      requests.push(request);
      return {
        transcript: String(request.studentText),
        tutorText: requests.length === 1 ? "First tutor reply?" : "Second tutor reply?",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 10,
          sttFinalToLlmFirstTokenMs: 20,
          llmFirstTokenToTtsFirstAudioMs: 30
        },
        timestamps: [{ word: "First", startMs: 0, endMs: 100 }]
      };
    },
    async interrupt() {
      return;
    },
    async reset() {
      return;
    }
  };

  render(<TutorSession transport={transport} />);

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "first student turn" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getAllByText("First tutor reply?").length).toBeGreaterThan(0));
  expect(screen.getByTestId("avatar-subtitle")).toHaveTextContent("First tutor reply?");

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "second student turn" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getAllByText("Second tutor reply?").length).toBeGreaterThan(0));
  expect(requests[0]).toMatchObject({ audioChunks: [] });
  expect(screen.getByTestId("avatar-subtitle")).toHaveTextContent("Second tutor reply?");

  fireEvent.click(screen.getByRole("button", { name: "Toggle history" }));
  await waitFor(() => expect(screen.getByText("History")).toBeInTheDocument());
  const historyPanel = screen.getByTestId("conversation-history-panel");
  expect(within(historyPanel).getByText("second student turn")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /New Lesson/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Toggle history" })).toHaveAttribute("aria-expanded", "false"));

  fireEvent.click(screen.getByRole("button", { name: "Toggle history" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Toggle history" })).toHaveAttribute("aria-expanded", "true"));
  await waitFor(() => expect(screen.getByText("Previous lessons")).toBeInTheDocument());
  expect(screen.getByText("Your conversation will appear here")).toBeInTheDocument();

  fireEvent.click(screen.getByText("first student turn"));

  fireEvent.click(screen.getByRole("button", { name: "Toggle history" }));
  await waitFor(() => expect(within(screen.getByTestId("conversation-history-panel")).getByText("second student turn")).toBeInTheDocument());
  expect(screen.getByLabelText("Student prompt")).toHaveValue("second student turn");
});

test("restores a saved lesson thread from browser storage", async () => {
  writePersistedLessonThread({
    avatarProviderId: "robot-css-2d",
    conversation: [
      {
        id: "1",
        transcript: "saved transcript",
        tutorText: "saved tutor reply",
      },
    ],
    gradeBand: "9-10",
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    preference: "Use slower examples",
    sessionId: "lesson-saved-1",
    studentPrompt: "saved prompt",
    subject: "science",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
    transcript: "saved transcript",
    tutorText: "saved tutor reply",
    version: 1,
  });

  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn() {
          return {
            transcript: "",
            tutorText: "",
            state: "idle",
            latency: {
              speechEndToSttFinalMs: 0,
              sttFinalToLlmFirstTokenMs: 0,
              llmFirstTokenToTtsFirstAudioMs: 0,
            },
            timestamps: [],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  // Wait for the persisted thread to be loaded
  await waitFor(() => expect(screen.getByLabelText("Student prompt")).toHaveValue("saved prompt"));
  expect(screen.getByLabelText("Subject")).toHaveValue("science");
  expect(screen.getByLabelText("Grade band")).toHaveValue("9-10");
  expect(screen.getByLabelText("Learning preference")).toHaveValue("Use slower examples");
  expect(screen.getByLabelText("Avatar")).toHaveValue("robot-css-2d");
  expect(screen.getByTestId("avatar-subtitle")).toHaveTextContent("saved tutor reply");

  fireEvent.click(screen.getByRole("button", { name: "Toggle history" }));
  await waitFor(() => expect(screen.getByText("History")).toBeInTheDocument());
  expect(screen.getByText("saved transcript")).toBeInTheDocument();
});

test("restoring a mismatched realtime lesson preserves the saved provider split", async () => {
  writePersistedLessonThread({
    avatarProviderId: "robot-css-2d",
    conversation: [],
    gradeBand: "6-8",
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    preference: "",
    sessionId: "lesson-mismatch-1",
    studentPrompt: "saved prompt",
    subject: "math",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    transcript: "",
    tutorText: "",
    version: 1,
  });

  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn() {
          return {
            transcript: "",
            tutorText: "",
            state: "idle",
            latency: {
              speechEndToSttFinalMs: 0,
              sttFinalToLlmFirstTokenMs: 0,
              llmFirstTokenToTtsFirstAudioMs: 0,
            },
            timestamps: [],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  await waitFor(() => expect(screen.getByLabelText("Student prompt")).toHaveValue("saved prompt"));
  expect(screen.getByLabelText("LLM provider")).toHaveValue("gemini");
  expect(screen.getByLabelText("LLM model")).toHaveValue("gemini-3-flash-preview");
  expect(screen.getByLabelText("TTS provider")).toHaveValue("openai-realtime");
  expect(screen.getByLabelText("TTS model")).toHaveValue("gpt-realtime-mini");
});

test("history shows per-turn debug payload", async () => {
  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn() {
          return {
            transcript: "debug this",
            tutorText: "debug reply",
            state: "speaking",
            latency: {
              speechEndToSttFinalMs: 11,
              sttFinalToLlmFirstTokenMs: 22,
              llmFirstTokenToTtsFirstAudioMs: 33,
            },
            timestamps: [{ word: "debug", startMs: 0, endMs: 80 }],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "debug this" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getAllByText("debug reply").length).toBeGreaterThan(0));
  fireEvent.click(screen.getByRole("button", { name: "Toggle history" }));
  await waitFor(() => expect(screen.getByText("History")).toBeInTheDocument());
  fireEvent.click(within(screen.getByTestId("turn-debug-1")).getByRole("button", { name: "Turn 1 debug info" }));

  await waitFor(() => expect(screen.getByText("Trace")).toBeInTheDocument());
  const turnDebug = within(screen.getByTestId("turn-debug-1"));
  expect(turnDebug.getByText("openai-realtime")).toBeInTheDocument();
  expect(turnDebug.getByText("text")).toBeInTheDocument();
  expect(turnDebug.getAllByText(/openai-realtime · gpt-realtime-mini/)).toHaveLength(2);
  expect(turnDebug.getByText(/1 · 0 ms -> 80 ms/)).toBeInTheDocument();
  expect(turnDebug.getByText(/STT 11 · LLM 22 · TTS 33/)).toBeInTheDocument();
});

test("history backfills a debug payload for restored legacy turns", async () => {
  writePersistedLessonThread({
    avatarProviderId: "human-css-2d",
    conversation: [
      {
        id: "turn-no-debug",
        transcript: "old question",
        tutorText: "old reply",
      },
    ],
    gradeBand: "6-8",
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    preference: "",
    sessionId: "lesson-no-debug",
    studentPrompt: "",
    subject: "math",
    transcript: "old question",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
    tutorText: "old reply",
    version: 1,
  });

  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn() {
          return {
            transcript: "",
            tutorText: "",
            state: "idle",
            latency: {
              speechEndToSttFinalMs: 0,
              sttFinalToLlmFirstTokenMs: 0,
              llmFirstTokenToTtsFirstAudioMs: 0,
            },
            timestamps: [],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Toggle history" }));
  await waitFor(() => expect(screen.getByText("History")).toBeInTheDocument());
  fireEvent.click(within(screen.getByTestId("turn-debug-turn-no-debug")).getByRole("button", { name: "Turn turn-no-debug debug info" }));
  expect(screen.getByText("Trace")).toBeInTheDocument();
  expect(screen.getAllByText("legacy").length).toBeGreaterThan(0);
  expect(screen.getByText(/gemini · gemini-3-flash-preview/)).toBeInTheDocument();
  expect(screen.getByText(/cartesia · sonic-2/)).toBeInTheDocument();
  expect(screen.getByText("legacy fallback")).toBeInTheDocument();
});

test("history toggle updates drawer accessibility state", async () => {
  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn() {
          return {
            transcript: "",
            tutorText: "",
            state: "idle",
            latency: {
              speechEndToSttFinalMs: 0,
              sttFinalToLlmFirstTokenMs: 0,
              llmFirstTokenToTtsFirstAudioMs: 0,
            },
            timestamps: [],
          };
        },
        async interrupt() {
          return;
        },
        async reset() {
          return;
        },
      }}
    />
  );

  const toggle = screen.getByRole("button", { name: "Toggle history" });
  const drawer = screen.getByTestId("history-drawer");

  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(drawer).toHaveAttribute("aria-hidden", "true");

  fireEvent.click(toggle);

  await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));
  expect(drawer).toHaveAttribute("aria-hidden", "false");
});
