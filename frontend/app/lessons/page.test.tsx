import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/lessons",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
  writeSessionPreferences: vi.fn(),
}));

vi.mock("../../lib/lesson_thread_store", () => ({
  hydrateLessonThreadStore: vi.fn().mockResolvedValue(undefined),
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
    sessionId: "active-lessons-lesson",
    studentPrompt: "",
    subject: "math",
    transcript: "",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
    tutorText: "",
    version: 1,
  }),
}));

import LessonsPage from "./page";

test("lessons page shows resume checkpoint and browse setup", async () => {
  render(<LessonsPage />);

  await waitFor(() => expect(screen.getByText("Resume checkpoint")).toBeInTheDocument());
  expect(screen.getByText("Browse setup")).toBeInTheDocument();
  expect(screen.getAllByText("Intro to Fractions").length).toBeGreaterThan(0);
  expect(screen.getAllByText("3-5").length).toBeGreaterThan(0);
});
