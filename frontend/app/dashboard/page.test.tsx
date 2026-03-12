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
    gradeBand: "6-8",
    interfaceLanguage: "en",
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    preference: "",
    pushNotifications: true,
    soundEffects: true,
    subject: "math",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
  }),
}));

vi.mock("../../lib/lesson_thread_store", () => ({
  hydrateLessonThreadStore: vi.fn().mockResolvedValue(undefined),
  readArchivedLessonThread: (id: string) => ({
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
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    preference: "",
    sessionId: id,
    studentPrompt: "",
    subject: "math",
    transcript: "",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    tutorText: "",
    version: 1,
  }),
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
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    preference: "",
    sessionId: "active-lesson",
    studentPrompt: "",
    subject: "math",
    transcript: "",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    tutorText: "",
    version: 1,
  }),
}));

import DashboardPage from "./page";

test("dashboard surfaces active lesson progress and archived resume links", async () => {
  render(<DashboardPage />);

  await waitFor(() => expect(screen.getByText("Resume Intro to Fractions")).toBeInTheDocument());
  expect(screen.getByText("Where you stopped")).toBeInTheDocument();
  expect(screen.getByText("Learning momentum")).toBeInTheDocument();
  expect(screen.getByText("Strongest subject")).toBeInTheDocument();
  expect(screen.getAllByText("Convert each fraction to twelfths").length).toBeGreaterThan(0);
  expect(screen.getByText("Saved lesson library")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Resume now" })).toHaveAttribute("href", "/session");
  expect(screen.getByRole("link", { name: "Continue lesson" })).toHaveAttribute("href", "/session");
  expect(screen.getByRole("link", { name: "Resume Linear Equations" })).toHaveAttribute("href", "/session?resume=archive-1");
});
