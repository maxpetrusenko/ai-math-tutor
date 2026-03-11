import React from "react";
import { afterEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TutorSession } from "./TutorSession";
import { BrowserAudioCapture } from "../lib/audio_capture";
import { clearPersistedLessonThread, writePersistedLessonThread } from "../lib/lesson_thread_store";

vi.mock("./Avatar3D", () => ({
  Avatar3D: () => <div>Avatar (3D)</div>,
}));

afterEach(() => {
  clearPersistedLessonThread();
  vi.restoreAllMocks();
});

test("send text turn clears the composer after a successful turn", async () => {
  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn(request) {
          return {
            transcript: request.studentText,
            tutorText: "Tutor reply",
            state: "speaking",
            latency: {
              speechEndToSttFinalMs: 10,
              sttFinalToLlmFirstTokenMs: 20,
              llmFirstTokenToTtsFirstAudioMs: 30,
            },
            timestamps: [{ word: "Tutor", startMs: 0, endMs: 100 }],
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
    target: { value: "send this text" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getByLabelText("Student prompt")).toHaveValue(""));
});

test("student prompt starts empty for a fresh lesson", async () => {
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

  await waitFor(() => expect(screen.getByText("Lesson")).toBeInTheDocument());
  expect(screen.getByLabelText("Student prompt")).toHaveValue("");
});

test("mic turn writes the final transcript into the composer", async () => {
  vi.spyOn(BrowserAudioCapture.prototype, "isSupported").mockReturnValue(true);
  vi.spyOn(BrowserAudioCapture.prototype, "start").mockResolvedValue();
  vi.spyOn(BrowserAudioCapture.prototype, "stop").mockResolvedValue([
    { sequence: 1, size: 320, bytesBase64: "YWJj", mimeType: "audio/webm" },
  ]);

  render(
    <TutorSession
      transport={{
        async connect() {
          return "connected";
        },
        async runTurn() {
          return {
            transcript: "2+2",
            tutorText: "It equals 4.",
            state: "speaking",
            latency: {
              speechEndToSttFinalMs: 10,
              sttFinalToLlmFirstTokenMs: 20,
              llmFirstTokenToTtsFirstAudioMs: 30,
            },
            timestamps: [{ word: "It", startMs: 0, endMs: 100 }],
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
  await waitFor(() => expect(screen.getByRole("button", { name: "Release to send" })).toBeInTheDocument());
  fireEvent.mouseUp(micButton, { button: 0 });

  await waitFor(() => expect(screen.getByLabelText("Student prompt")).toHaveValue("2+2"));
});

test("restored lessons do not reuse duplicate conversation keys on the next turn", async () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  writePersistedLessonThread({
    avatarProviderId: "robot-css-2d",
    conversation: [
      {
        id: "1",
        transcript: "older transcript",
        tutorText: "older tutor reply",
      },
      {
        id: "1",
        transcript: "saved transcript",
        tutorText: "saved tutor reply",
      },
    ],
    gradeBand: "9-10",
    llmModel: "gemini-2.5-flash",
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
        async runTurn(request) {
          return {
            transcript: request.studentText,
            tutorText: "new tutor reply",
            state: "speaking",
            latency: {
              speechEndToSttFinalMs: 10,
              sttFinalToLlmFirstTokenMs: 20,
              llmFirstTokenToTtsFirstAudioMs: 30,
            },
            timestamps: [{ word: "new", startMs: 0, endMs: 100 }],
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
  fireEvent.change(screen.getByLabelText("Student prompt"), {
    target: { value: "fresh question" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getAllByText("new tutor reply").length).toBeGreaterThan(0));
  expect(
    consoleErrorSpy.mock.calls.some(([message]) =>
      typeof message === "string" && message.includes("Encountered two children with the same key")
    )
  ).toBe(false);
});

test("send surfaces transport connection failures without appending a new turn", async () => {
  render(
    <TutorSession
      transport={{
        async connect() {
          return "failed";
        },
        async runTurn() {
          throw new Error("WebSocket connection failed");
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
    target: { value: "1+1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("WebSocket connection failed"));
  expect(screen.queryByTestId("conversation-history-panel")).not.toBeInTheDocument();
});
