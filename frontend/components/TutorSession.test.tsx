import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { type SessionTransport, TutorSession, type TutorTurnRequest } from "./TutorSession";
import { BrowserAudioCapture } from "../lib/audio_capture";
import {
  clearPersistedLessonThread,
  persistArchivedLessonThread,
  readPersistedLessonThread,
  writePersistedLessonThread,
} from "../lib/lesson_thread_store";
import { appendSessionActivityLog, resetSessionActivityLogForTests } from "../lib/session_activity_log";
import { writeSessionPreferences } from "../lib/session_preferences";

const { talkingAvatarRenderSpy } = vi.hoisted(() => ({
  talkingAvatarRenderSpy: vi.fn(),
}));

vi.mock("./TalkingHeadAvatar", () => ({
  TalkingHeadAvatar: ({ frame, speechCue }: {
    frame: { activeWord?: string; mouthOpen: number; state: string };
    speechCue?: { id: string; words: string[] } | null;
  }) => {
    talkingAvatarRenderSpy(frame, speechCue);
    return (
      <div
        data-active-word={frame.activeWord ?? ""}
        data-avatar-state={frame.state}
        data-mouth-open={frame.mouthOpen}
        data-viseme-cue-id={speechCue?.id ?? ""}
        data-viseme-words={speechCue?.words.join(" ") ?? ""}
        data-testid="talking-avatar-frame"
      >
        Talking avatar
      </div>
    );
  },
}));

function resetSessionState() {
  clearPersistedLessonThread();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/session");
  document.cookie = "nerdy_avatar_provider=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
}

beforeEach(() => {
  talkingAvatarRenderSpy.mockClear();
  resetSessionState();
  resetSessionActivityLogForTests();
});

afterEach(() => {
  resetSessionState();
  resetSessionActivityLogForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function createPendingAudio() {
  return {
    onended: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onplaying: null as (() => void) | null,
    pause: vi.fn(),
    play: vi.fn(() => new Promise<void>(() => undefined)),
    volume: 1,
  };
}

function createConnectedTransport(overrides: Partial<SessionTransport> = {}) {
  return {
    async connect() {
      return "connected" as const;
    },
    async interrupt() {
      return;
    },
    async reset() {
      return;
    },
    async runTurn(request: TutorTurnRequest) {
      return {
        transcript: request.studentText,
        tutorText: "Tutor reply",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 120,
          sttFinalToLlmFirstTokenMs: 140,
          llmFirstTokenToTtsFirstAudioMs: 110,
        },
        timestamps: [{ word: "Tutor", startMs: 0, endMs: 100 }],
      };
    },
    ...overrides,
  };
}

async function renderSession(
  transport: SessionTransport = createConnectedTransport()
) {
  render(<TutorSession transport={transport} />);
  await waitFor(() => expect(screen.getByText("Open Session")).toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole("button", { name: "Open session history" })).toBeInTheDocument());
}

test("keeps the avatar idle until provider audio actually starts", async () => {
  const audio = createPendingAudio();
  let animationFrameCallback: FrameRequestCallback | null = null;
  vi.stubGlobal("Audio", vi.fn(() => audio));
  vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
  vi.spyOn(performance, "now").mockReturnValue(1_000);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    animationFrameCallback = callback;
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

  await renderSession(createConnectedTransport({
    async runTurn(request) {
      return {
        transcript: String(request.studentText),
        tutorText: "Delayed audio",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 10,
          sttFinalToLlmFirstTokenMs: 20,
          llmFirstTokenToTtsFirstAudioMs: 30,
        },
        timestamps: [{ word: "Delayed", startMs: 0, endMs: 180 }],
        audioSegments: [{
          text: "Delayed audio",
          audioBase64: "YQ==",
          audioMimeType: "audio/wav",
          durationMs: 300,
        }],
      };
    },
  }));

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "wait for playback" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(audio.play).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId("talking-avatar-frame")).toHaveAttribute("data-avatar-state", "idle");

  await act(async () => {
    audio.onplaying?.();
    await Promise.resolve();
  });

  expect(screen.getByTestId("talking-avatar-frame")).toHaveAttribute("data-avatar-state", "speaking");
  expect(screen.getByTestId("talking-avatar-frame")).toHaveAttribute("data-active-word", "Delayed");

  const rendersAtPlaybackStart = talkingAvatarRenderSpy.mock.calls.length;
  await act(async () => {
    animationFrameCallback?.(1_010);
    await Promise.resolve();
  });
  expect(talkingAvatarRenderSpy).toHaveBeenCalledTimes(rendersAtPlaybackStart);

  await act(async () => {
    animationFrameCallback?.(1_040);
    await Promise.resolve();
  });
  expect(talkingAvatarRenderSpy.mock.calls.length).toBeGreaterThan(rendersAtPlaybackStart);
});

test("continues the avatar timeline at the cumulative offset for queued audio segments", async () => {
  const firstAudio = createPendingAudio();
  const secondAudio = createPendingAudio();
  vi.stubGlobal("Audio", vi.fn()
    .mockImplementationOnce(() => firstAudio)
    .mockImplementationOnce(() => secondAudio));
  vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });

  await renderSession(createConnectedTransport({
    async runTurn(request) {
      return {
        transcript: String(request.studentText),
        tutorText: "First then second",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 10,
          sttFinalToLlmFirstTokenMs: 20,
          llmFirstTokenToTtsFirstAudioMs: 30,
        },
        timestamps: [
          { word: "First", startMs: 0, endMs: 180 },
          { word: "second", startMs: 300, endMs: 480 },
        ],
        audioSegments: [
          { text: "First", audioBase64: "YQ==", audioMimeType: "audio/wav", durationMs: 300 },
          { text: "second", audioBase64: "Yg==", audioMimeType: "audio/wav", durationMs: 300 },
        ],
      };
    },
  }));

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "play both segments" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(firstAudio.play).toHaveBeenCalledTimes(1));

  await act(async () => {
    firstAudio.onplaying?.();
    await Promise.resolve();
  });
  expect(screen.getByTestId("talking-avatar-frame")).toHaveAttribute("data-active-word", "First");
  expect(screen.getByTestId("talking-avatar-frame")).toHaveAttribute("data-viseme-words", "First");

  await act(async () => {
    firstAudio.onended?.();
    await Promise.resolve();
  });
  await waitFor(() => expect(secondAudio.play).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId("talking-avatar-frame")).not.toHaveAttribute("data-avatar-state", "speaking");

  await act(async () => {
    secondAudio.onplaying?.();
    await Promise.resolve();
  });
  expect(screen.getByTestId("talking-avatar-frame")).toHaveAttribute("data-avatar-state", "speaking");
  expect(screen.getByTestId("talking-avatar-frame")).toHaveAttribute("data-active-word", "second");
  expect(screen.getByTestId("talking-avatar-frame")).toHaveAttribute("data-viseme-words", "second");
});

test("text-only tutor audio waits for browser speech completion between segments", async () => {
  const utterances: Array<{ text: string; onend?: () => void; onerror?: () => void }> = [];
  const speak = vi.fn((utterance: { text: string; onend?: () => void; onerror?: () => void }) => {
    utterances.push(utterance);
  });
  vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class SpeechSynthesisUtterance {
      text: string;
      onend?: () => void;
      onerror?: () => void;

      constructor(text: string) {
        this.text = text;
      }
    }
  );

  await renderSession(createConnectedTransport({
    async runTurn(request) {
      return {
        transcript: String(request.studentText),
        tutorText: "First phrase. Second phrase.",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 10,
          sttFinalToLlmFirstTokenMs: 20,
          llmFirstTokenToTtsFirstAudioMs: 30,
        },
        timestamps: [
          { word: "First", startMs: 0, endMs: 10 },
          { word: "Second", startMs: 10, endMs: 20 },
        ],
        audioSegments: [
          { text: "First phrase.", durationMs: 10 },
          { text: "Second phrase.", durationMs: 10 },
        ],
      };
    },
  }));

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "use browser speech" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(speak).toHaveBeenCalledTimes(1);

  await act(async () => {
    utterances[0]?.onend?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(speak).toHaveBeenCalledTimes(2);
  expect(utterances[1]?.text).toBe("Second phrase.");
});

test("renders a clean session shell and sends turns with stored defaults", async () => {
  const requests: Array<Record<string, unknown>> = [];
  writeSessionPreferences({
    gradeBand: "9-10",
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    preference: "Use slower examples",
    subject: "science",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
  });

  await renderSession(createConnectedTransport({
    async runTurn(request) {
      requests.push(request as Record<string, unknown>);
      return {
        transcript: String(request.studentText),
        tutorText: "Nice start. What should you isolate first?",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 120,
          sttFinalToLlmFirstTokenMs: 140,
          llmFirstTokenToTtsFirstAudioMs: 110,
        },
        timestamps: [{ word: "Nice", startMs: 0, endMs: 100 }],
      };
    },
  }));

  expect(screen.getAllByText("Session").length).toBeGreaterThan(0);
  expect(screen.getByText("Nerdy AI Tutor")).toBeInTheDocument();
  expect(screen.getByText("Open ended session for questions, drills, and follow ups.")).toBeInTheDocument();
  expect(screen.queryByLabelText("Session setup links")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Subject")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "I do not understand how to solve for x." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() =>
    expect(screen.getAllByText("Nice start. What should you isolate first?").length).toBeGreaterThan(0)
  );
  expect(requests[0]).toMatchObject({
    gradeBand: "9-10",
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    studentProfile: {
      avatarLabel: "Nerdy Tutor",
      avatarPersona: expect.any(String),
      preference: "Use slower examples",
    },
    subject: "science",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
  });
});

test("fresh sessions use the unified socket defaults", async () => {
  const requests: Array<Record<string, unknown>> = [];

  await renderSession(createConnectedTransport({
    async runTurn(request) {
      requests.push(request as Record<string, unknown>);
      return {
        transcript: String(request.studentText),
        tutorText: "Tutor reply",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 120,
          sttFinalToLlmFirstTokenMs: 140,
          llmFirstTokenToTtsFirstAudioMs: 110,
        },
        timestamps: [{ word: "Tutor", startMs: 0, endMs: 100 }],
      };
    },
  }));

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "Help me with fractions." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0]).toMatchObject({
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
  });
  expect(screen.queryByText("Gemini 3 Flash Preview")).not.toBeInTheDocument();
});

test("session top bar keeps only the session tool icons", async () => {
  writeSessionPreferences({
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
  });

  await renderSession();

  expect(screen.getByRole("button", { name: "Open session history" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open session logs" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start new session" })).toBeInTheDocument();
  expect(screen.queryByText("GPT Realtime Mini")).not.toBeInTheDocument();
  expect(screen.queryByText("connected")).not.toBeInTheDocument();
});

test("session keeps brain controls out of the composer", async () => {
  const requests: Array<Record<string, unknown>> = [];

  await renderSession(createConnectedTransport({
    async runTurn(request) {
      requests.push(request as Record<string, unknown>);
      return {
        transcript: String(request.studentText),
        tutorText: "Tutor reply",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 120,
          sttFinalToLlmFirstTokenMs: 140,
          llmFirstTokenToTtsFirstAudioMs: 110,
        },
        timestamps: [{ word: "Tutor", startMs: 0, endMs: 100 }],
      };
    },
  }));

  expect(screen.queryByLabelText("Session LLM provider")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Session LLM model")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "Use the saved model for this one." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0]).toMatchObject({
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
  });
});

test("hold-to-talk mic transcribes on release and waits for explicit send for the openai combo", async () => {
  writeSessionPreferences({
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
  });

  const requests: Array<Record<string, unknown>> = [];
  const transcriptions: Array<Record<string, unknown>> = [];
  const startSpy = vi.spyOn(BrowserAudioCapture.prototype, "start").mockResolvedValue();
  const stopSpy = vi
    .spyOn(BrowserAudioCapture.prototype, "stop")
    .mockResolvedValue([{ sequence: 1, size: 320, bytesBase64: "YWJj" }]);
  vi.spyOn(BrowserAudioCapture.prototype, "isSupported").mockReturnValue(true);

  await renderSession(createConnectedTransport({
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
  }));

  const micButton = screen.getByRole("button", { name: "Hold to talk" });
  fireEvent.mouseDown(micButton, { button: 0 });
  fireEvent.pointerDown(micButton, { button: 0, pointerId: 1 });
  await waitFor(() => expect(startSpy).toHaveBeenCalledTimes(1));
  const activeMicButton = screen.getByRole("button", { name: /Hold to talk|Release to send/ });
  fireEvent.pointerUp(activeMicButton, { button: 0, pointerId: 1 });
  fireEvent.mouseUp(activeMicButton, { button: 0 });

  await waitFor(() => expect(stopSpy).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(transcriptions).toHaveLength(1));
  expect(requests).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0]).toMatchObject({
    llmProvider: "openai-realtime",
    ttsProvider: "openai-realtime",
  });
});

test("mic transcription receives the stored runtime selection for socket combos", async () => {
  writeSessionPreferences({
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
  });

  const transcriptions: Array<Record<string, unknown>> = [];
  vi.spyOn(BrowserAudioCapture.prototype, "isSupported").mockReturnValue(true);
  vi.spyOn(BrowserAudioCapture.prototype, "start").mockResolvedValue();
  vi.spyOn(BrowserAudioCapture.prototype, "stop").mockResolvedValue([
    { sequence: 1, size: 320, bytesBase64: "YWJj", mimeType: "audio/webm" },
  ]);

  await renderSession(createConnectedTransport({
    async transcribeAudio(request) {
      transcriptions.push(request as Record<string, unknown>);
      request.onTranscriptUpdate?.("voice transcript");
      return "voice transcript";
    },
  }));

  await waitFor(() => expect(screen.getByRole("button", { name: "Hold to talk" })).toBeEnabled());
  const micButton = screen.getByRole("button", { name: "Hold to talk" });
  fireEvent.mouseDown(micButton, { button: 0 });
  fireEvent.pointerDown(micButton, { button: 0, pointerId: 1 });
  const activeMicButton = await screen.findByRole("button", { name: /Hold to talk|Release to send/ });
  fireEvent.pointerUp(activeMicButton, { button: 0, pointerId: 1 });
  fireEvent.mouseUp(activeMicButton, { button: 0 });

  await waitFor(() => expect(transcriptions).toHaveLength(1));
  expect(transcriptions[0]).toMatchObject({
    llmProvider: "gemini",
    ttsProvider: "cartesia",
  });
});

test("applies backend TalkingHead config to the active avatar view", async () => {
  await renderSession(createConnectedTransport({
    async runTurn(request) {
      return {
        transcript: String(request.studentText),
        tutorText: "Let us try the local tutor.",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 10,
          sttFinalToLlmFirstTokenMs: 20,
          llmFirstTokenToTtsFirstAudioMs: 30,
        },
        timestamps: [{ word: "avatar", startMs: 0, endMs: 100 }],
        avatarConfig: {
          assetRef: "nerdy-tutor",
          provider: "talkinghead",
          type: "3d",
          model_url: "/avatars/nerdy-tutor.glb?v=7a05c998",
        },
      };
    },
  }));

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "show me the local tutor" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getByTestId("avatar-surface-talkinghead")).toBeInTheDocument());
});

test("session uses the avatar selected from the avatar menu", async () => {
  window.localStorage.setItem("nerdy_avatar_provider_preference", "human-threejs-3d");

  await renderSession();

  await waitFor(() => expect(screen.getByTestId("avatar-surface-talkinghead")).toBeInTheDocument());
  expect(screen.queryByText("Ready for a new lesson?")).not.toBeInTheDocument();
});

test("stale managed avatar preferences migrate to the local tutor", async () => {
  const requests: Array<Record<string, unknown>> = [];
  window.localStorage.setItem("nerdy_avatar_provider_preference", "simli-b97a7777-live");
  writeSessionPreferences({
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
  });

  await renderSession(createConnectedTransport({
    async runTurn(request) {
      requests.push(request as Record<string, unknown>);
      return {
        transcript: String(request.studentText),
        tutorText: "Tutor reply",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 120,
          sttFinalToLlmFirstTokenMs: 140,
          llmFirstTokenToTtsFirstAudioMs: 110,
        },
        timestamps: [{ word: "Tutor", startMs: 0, endMs: 100 }],
      };
    },
  }));

  await waitFor(() => expect(screen.getByTestId("avatar-surface-talkinghead")).toBeInTheDocument());
  expect(screen.queryByTestId("managed-avatar-session")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Student prompt")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "talk back through text" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getAllByText("Tutor reply").length).toBeGreaterThan(0));
  expect(requests[0]).toMatchObject({
    avatarProviderId: "nerdy-talkinghead-3d",
    llmProvider: "gemini",
    llmModel: "gemini-3-flash-preview",
    ttsProvider: "cartesia",
    ttsModel: "sonic-2",
    voiceConfig: { voice_id: "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Open session history" }));
  expect(screen.getByText("talk back through text")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Turn 1 debug info"));
  expect(screen.getByText("Trace")).toBeInTheDocument();
});

test("persisted lessons do not override the globally selected avatar", async () => {
  window.localStorage.setItem("nerdy_avatar_provider_preference", "sage-svg-2d");
  writePersistedLessonThread({
    avatarProviderId: "robot-css-2d",
    conversation: [],
    gradeBand: "6-8",
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    preference: "",
    sessionId: "lesson-saved-avatar",
    studentPrompt: "",
    subject: "math",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
    transcript: "",
    tutorText: "",
    version: 1,
  });

  await renderSession();

  await waitFor(() => expect(screen.getByTestId("avatar-surface-talkinghead")).toBeInTheDocument());
  expect(screen.getAllByText("Session").length).toBeGreaterThan(0);
  expect(screen.queryByText("connected")).not.toBeInTheDocument();
});

test("same-mode backend avatar configs do not override the selected avatar", async () => {
  window.localStorage.setItem("nerdy_avatar_provider_preference", "sage-svg-2d");

  await renderSession(createConnectedTransport({
    async runTurn(request) {
      return {
        transcript: String(request.studentText),
        tutorText: "Keeping your chosen tutor.",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 10,
          sttFinalToLlmFirstTokenMs: 20,
          llmFirstTokenToTtsFirstAudioMs: 30,
        },
        timestamps: [{ word: "Keeping", startMs: 0, endMs: 100 }],
        avatarConfig: {
          provider: "css",
          type: "2d",
          assetRef: "robot",
        },
      };
    },
  }));

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "keep sage" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getAllByText("Keeping your chosen tutor.").length).toBeGreaterThan(0));
  expect(screen.getAllByText("Session").length).toBeGreaterThan(0);
});

test("send text turn appends conversation history and new lesson clears it", async () => {
  let callCount = 0;

  await renderSession(createConnectedTransport({
    async runTurn(request) {
      callCount += 1;
      return {
        transcript: String(request.studentText),
        tutorText: callCount === 1 ? "First tutor reply?" : "Second tutor reply?",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 10,
          sttFinalToLlmFirstTokenMs: 20,
          llmFirstTokenToTtsFirstAudioMs: 30,
        },
        timestamps: [{ word: "Tutor", startMs: 0, endMs: 100 }],
      };
    },
  }));

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "first student turn" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.getAllByText("First tutor reply?").length).toBeGreaterThan(0));

  fireEvent.click(screen.getByRole("button", { name: "Open session history" }));
  expect(screen.getAllByText("first student turn").length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole("button", { name: "Start new session" }));

  await waitFor(() => expect(screen.queryByText("First tutor reply?")).not.toBeInTheDocument());
  expect(screen.getByLabelText("Student prompt")).toHaveValue("");
});

test("send text turns persist unique conversation ids", async () => {
  let callCount = 0;

  await renderSession(createConnectedTransport({
    async runTurn(request) {
      callCount += 1;
      return {
        transcript: String(request.studentText),
        tutorText: `reply ${callCount}`,
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 10,
          sttFinalToLlmFirstTokenMs: 20,
          llmFirstTokenToTtsFirstAudioMs: 30,
        },
        timestamps: [{ word: "Tutor", startMs: 0, endMs: 100 }],
      };
    },
  }));

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "Persist this lesson" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.getAllByText("reply 1").length).toBeGreaterThan(0));

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "Persist this lesson again" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.getAllByText("reply 2").length).toBeGreaterThan(0));

  const persistedThread = readPersistedLessonThread();
  expect(persistedThread?.conversation.map((turn) => turn.id)).toEqual(["1", "2"]);
});

test("restores persisted lessons using saved defaults and conversation state", async () => {
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

  await renderSession();

  await waitFor(() => expect(screen.getByLabelText("Student prompt")).toHaveValue("saved prompt"));
  expect(screen.getAllByText("Session").length).toBeGreaterThan(0);
  expect(screen.queryByText("Gemini 3 Flash Preview")).not.toBeInTheDocument();
  expect(screen.getAllByText("saved tutor reply").length).toBeGreaterThan(0);
});

test("restores persisted lesson progress and leads with the saved next question", async () => {
  writePersistedLessonThread({
    avatarProviderId: "sage-svg-2d",
    conversation: [
      {
        id: "1",
        transcript: "lets learn fractions",
        tutorText: "We found a common denominator already.",
      },
    ],
    gradeBand: "3-5",
    lessonState: {
      currentStepIndex: 1,
      currentTask: "Convert each fraction to twelfths",
      lastTutorAction: "Matched denominators",
      lessonId: 3,
      lessonTitle: "Intro to Fractions",
      nextQuestion: "How do we rewrite 1/4 as a fraction with denominator 12?",
      program: [
        "Understand what the fractions represent",
        "Add fractions with unlike denominators",
        "Check the answer with one more example",
      ],
      startedFromCatalog: true,
    },
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    preference: "",
    sessionId: "lesson-fractions-1",
    studentPrompt: "lets learn fractions",
    subject: "math",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    transcript: "lets learn fractions",
    tutorText: "We found a common denominator already.",
    version: 1,
  });

  await renderSession();

  await waitFor(() => expect(screen.getAllByText("Intro to Fractions").length).toBeGreaterThan(0));
  expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
  expect(screen.getByText("Convert each fraction to twelfths")).toBeInTheDocument();
  expect(screen.getByText("How do we rewrite 1/4 as a fraction with denominator 12?")).toBeInTheDocument();
});

test("history shows per-turn debug payload", async () => {
  appendSessionActivityLog({
    event: "session.restored",
    level: "info",
    scope: "session-socket",
    summary: "socket restored",
  });

  await renderSession(createConnectedTransport({
    async runTurn(request) {
      return {
        transcript: String(request.studentText),
        tutorText: "debug reply",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 10,
          sttFinalToLlmFirstTokenMs: 20,
          llmFirstTokenToTtsFirstAudioMs: 30,
          requiredEventCoverageComplete: false,
        },
        timestamps: [{ word: "debug", startMs: 0, endMs: 100 }],
      };
    },
  }));

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "debug me" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.getAllByText("debug reply").length).toBeGreaterThan(0));

  fireEvent.click(screen.getByRole("button", { name: "Open session history" }));
  fireEvent.click(screen.getByLabelText("Turn 1 debug info"));

  expect(screen.getByText("Trace")).toBeInTheDocument();
  expect(screen.getByText("Request")).toBeInTheDocument();
  expect(screen.getByText("Output")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Raw"));
  expect(screen.getByText(/"sessionEvents": \[/)).toBeInTheDocument();
  expect(screen.getByText(/"summary": "socket restored"/)).toBeInTheDocument();
});

test("topbar logs drawer shows session events for AI inspection", async () => {
  appendSessionActivityLog({
    event: "session.restored",
    level: "info",
    metadata: { sessionId: "lesson-42" },
    scope: "session-socket",
    summary: "socket restored",
  });

  await renderSession();

  fireEvent.click(screen.getByRole("button", { name: "Open session logs" }));
  expect(await screen.findByRole("heading", { name: "Logs" })).toBeInTheDocument();
  expect(screen.getByText("socket restored")).toBeInTheDocument();
  expect(screen.getByText(/lesson-42/)).toBeInTheDocument();
});

test("history debug payload upgrades to complete coverage after frontend playback metrics land", async () => {
  const audioInstance = {
    onended: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onplaying: null as (() => void) | null,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    volume: 1,
  };
  vi.stubGlobal("Audio", vi.fn(() => audioInstance));
  vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class SpeechSynthesisUtterance {
      text: string;

      constructor(text: string) {
        this.text = text;
      }
    }
  );

  await renderSession(createConnectedTransport({
    async runTurn(request) {
      return {
        transcript: String(request.studentText),
        tutorText: "debug reply",
        state: "speaking",
        latency: {
          speechEndToSttFinalMs: 10,
          sttFinalToLlmFirstTokenMs: 20,
          llmFirstTokenToTtsFirstAudioMs: 30,
        },
        timestamps: [],
        audioSegments: [
          {
            text: "debug reply",
            audioBase64: "YQ==",
            audioMimeType: "audio/wav",
          },
        ],
      };
    },
  }));

  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "debug me" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.getAllByText("debug reply").length).toBeGreaterThan(0));
  await waitFor(() => expect(audioInstance.play).toHaveBeenCalledTimes(1));

  fireEvent.click(screen.getByRole("button", { name: "Open session history" }));
  fireEvent.click(screen.getByLabelText("Turn 1 debug info"));
  fireEvent.click(screen.getByText("Raw"));

  expect(screen.getByText(/"requiredEventCoverageComplete": false/)).toBeInTheDocument();

  await act(async () => {
    audioInstance.onended?.();
    await Promise.resolve();
  });

  await waitFor(() =>
    expect(screen.getByText(/"requiredEventCoverageComplete": true/)).toBeInTheDocument()
  );
  expect(screen.getByText(/"speechEndToAudioDoneMs":/)).toBeInTheDocument();
});

test("failed mic transcription is still saved into history with debug state", async () => {
  vi.spyOn(BrowserAudioCapture.prototype, "isSupported").mockReturnValue(true);
  vi.spyOn(BrowserAudioCapture.prototype, "start").mockResolvedValue();
  vi.spyOn(BrowserAudioCapture.prototype, "stop").mockResolvedValue([
    { sequence: 1, size: 320, bytesBase64: "YWJj", mimeType: "audio/webm" },
  ]);

  await renderSession(createConnectedTransport({
    async transcribeAudio() {
      throw new Error("Realtime token request failed: error code: 504");
    },
  }));

  const micButton = screen.getByRole("button", { name: "Hold to talk" });
  fireEvent.mouseDown(micButton, { button: 0 });
  fireEvent.pointerDown(micButton, { button: 0, pointerId: 1 });
  const activeMicButton = await screen.findByRole("button", { name: /Hold to talk|Release to send/ });
  fireEvent.pointerUp(activeMicButton, { button: 0, pointerId: 1 });
  fireEvent.mouseUp(activeMicButton, { button: 0 });

  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Realtime token request failed: error code: 504")
  );

  fireEvent.click(screen.getByRole("button", { name: "Open session history" }));
  await waitFor(() => expect(screen.getByTestId("conversation-history-panel")).toBeInTheDocument());
  expect(screen.getByText("Voice input failed")).toBeInTheDocument();
  expect(screen.getAllByText("Realtime token request failed: error code: 504").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByLabelText("Turn 1 debug info"));
  fireEvent.click(screen.getByText("Raw"));
  expect(screen.getByText(/"state": "failed"/)).toBeInTheDocument();
});

test("no-speech mic misses stay out of history and show a retry hint", async () => {
  vi.spyOn(BrowserAudioCapture.prototype, "isSupported").mockReturnValue(true);
  vi.spyOn(BrowserAudioCapture.prototype, "start").mockResolvedValue();
  vi.spyOn(BrowserAudioCapture.prototype, "stop").mockResolvedValue([
    { sequence: 1, size: 320, bytesBase64: "YWJj", mimeType: "audio/webm" },
  ]);

  await renderSession(createConnectedTransport({
    async transcribeAudio() {
      throw new Error("No speech detected");
    },
  }));

  const micButton = screen.getByRole("button", { name: "Hold to talk" });
  fireEvent.mouseDown(micButton, { button: 0 });
  fireEvent.pointerDown(micButton, { button: 0, pointerId: 1 });
  const activeMicButton = await screen.findByRole("button", { name: /Hold to talk|Release to send/ });
  fireEvent.pointerUp(activeMicButton, { button: 0, pointerId: 1 });
  fireEvent.mouseUp(activeMicButton, { button: 0 });

  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("No speech detected. Hold the mic a bit longer and try again.")
  );

  expect(screen.queryByText("Voice input failed")).not.toBeInTheDocument();
  expect(screen.queryByText("No speech detected")).not.toBeInTheDocument();
});

test("closing history returns focus to the composer instead of hiding focused drawer controls", async () => {
  await renderSession();

  fireEvent.click(screen.getByRole("button", { name: "Open session history" }));
  const closeButton = await screen.findByRole("button", { name: "Close history" });
  closeButton.focus();
  fireEvent.click(closeButton);

  await waitFor(() => expect(screen.getByLabelText("Student prompt")).toHaveFocus());
});

test("resumes archived lessons from history", async () => {
  await persistArchivedLessonThread({
    avatarProviderId: "human-css-2d",
    conversation: [
      { id: "1", transcript: "archived question", tutorText: "archived answer" },
    ],
    gradeBand: "6-8",
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    preference: "",
    sessionId: "archived-session-1",
    studentPrompt: "archived question",
    subject: "math",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    transcript: "archived question",
    tutorText: "archived answer",
    version: 1,
  });

  await renderSession();

  fireEvent.click(screen.getByRole("button", { name: "Open session history" }));
  fireEvent.click(screen.getByTestId(/resume-lesson-/));

  await waitFor(() => expect(screen.getAllByText("archived answer").length).toBeGreaterThan(0));
});

test("resume query restores an archived lesson directly", async () => {
  await persistArchivedLessonThread({
    avatarProviderId: "human-css-2d",
    conversation: [
      { id: "1", transcript: "archived question", tutorText: "archived answer" },
    ],
    gradeBand: "6-8",
    lessonState: {
      currentStepIndex: 0,
      currentTask: "Solve one-step linear equations",
      lessonId: 6,
      lessonTitle: "Linear Equations",
      nextQuestion: "What do you do first to solve x + 5 = 12?",
      program: [
        "Identify the variable",
        "Undo operations step by step",
        "Check the solution",
      ],
      startedFromCatalog: true,
    },
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    preference: "",
    sessionId: "archived-session-2",
    studentPrompt: "archived question",
    subject: "math",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    transcript: "archived question",
    tutorText: "archived answer",
    version: 1,
  });

  const archiveId = window.localStorage.getItem("nerdy.lesson-thread.v2");
  const parsed = archiveId ? JSON.parse(archiveId) : null;
  const lessonId = parsed?.archive?.[0]?.id as string;
  window.history.replaceState({}, "", `/session?resume=${lessonId}`);

  await renderSession();

  await waitFor(() => expect(screen.getAllByText("archived answer").length).toBeGreaterThan(0));
  expect(screen.getAllByText("Linear Equations").length).toBeGreaterThan(0);
});
