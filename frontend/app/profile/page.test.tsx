import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/firebase_auth", () => ({
  useFirebaseAuth: () => ({
    user: {
      displayName: "Alex Johnson",
      email: "alex@example.com",
    },
  }),
}));

vi.mock("../../lib/session_preferences", () => ({
  readSessionPreferences: () => ({
    audioVolume: 0.8,
    gradeBand: "3-5",
    interfaceLanguage: "en",
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    preference: "More worked examples",
    pushNotifications: true,
    soundEffects: true,
    subject: "math",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
  }),
}));

vi.mock("../../lib/lesson_thread_store", () => ({
  hydrateLessonThreadStore: vi.fn().mockResolvedValue(undefined),
  listArchivedLessonThreads: () => [
    {
      gradeBand: "6-8",
      id: "archive-1",
      subject: "math",
      title: "Linear Equations",
      turnCount: 2,
      updatedAt: "2026-03-11T00:00:00Z",
    },
  ],
  readArchivedLessonThread: () => ({
    avatarProviderId: "sage-svg-2d",
    conversation: [],
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
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    preference: "More worked examples",
    sessionId: "archive-1",
    studentPrompt: "",
    subject: "math",
    transcript: "",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
    tutorText: "",
    version: 1,
  }),
  readPersistedLessonThread: () => ({
    avatarProviderId: "sage-svg-2d",
    conversation: [],
    gradeBand: "3-5",
    lessonState: {
      currentStepIndex: 1,
      currentTask: "Convert each fraction to twelfths",
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
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    preference: "More worked examples",
    sessionId: "active-profile-lesson",
    studentPrompt: "",
    subject: "math",
    transcript: "",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
    tutorText: "",
    version: 1,
  }),
}));

import ProfilePage from "./page";

test("profile surfaces saved lesson library and current learner snapshot", async () => {
  render(<ProfilePage />);

  await waitFor(() => expect(screen.getByText("Saved lesson library")).toBeInTheDocument());
  expect(screen.getByText("Learning profile")).toBeInTheDocument();
  expect(screen.getByText("Achievements earned")).toBeInTheDocument();
  expect(screen.getByText("Strongest subject")).toBeInTheDocument();
  expect(screen.getAllByText("Sage").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Linear Equations").length).toBeGreaterThan(0);
  expect(screen.getByText("Resume Intro to Fractions")).toBeInTheDocument();
});
