import React from "react";
import { render, screen } from "@testing-library/react";

const { writeSessionPreferences } = vi.hoisted(() => ({
  writeSessionPreferences: vi.fn((value) => value),
}));

vi.mock("../../lib/firebase_auth", () => ({
  useFirebaseAuth: () => ({
    signOutUser: vi.fn().mockResolvedValue(undefined),
    user: {
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
  writeSessionPreferences,
}));

import SettingsPage from "./page";

test("settings shows a current setup summary for the learner", () => {
  render(<SettingsPage />);

  expect(screen.getByText("Current setup")).toBeInTheDocument();
  expect(screen.getAllByText("Math").length).toBeGreaterThan(0);
  expect(screen.getAllByText("3-5").length).toBeGreaterThan(0);
  expect(screen.getAllByText("English").length).toBeGreaterThan(0);
});
