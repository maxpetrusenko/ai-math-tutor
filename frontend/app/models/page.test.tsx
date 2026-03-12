import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const { writeSessionPreferences } = vi.hoisted(() => ({
  writeSessionPreferences: vi.fn((value) => value),
}));

vi.mock("../../lib/session_preferences", () => ({
  readSessionPreferences: () => ({
    audioVolume: 0.8,
    gradeBand: "6-8",
    interfaceLanguage: "en",
    llmModel: "gemini-3-flash-preview",
    llmProvider: "gemini",
    preference: "",
    pushNotifications: true,
    soundEffects: true,
    subject: "math",
    ttsModel: "sonic-2",
    ttsProvider: "cartesia",
  }),
  writeSessionPreferences,
}));

import ModelsPage from "./page";

test("models lets the learner switch tutor brain with curated choice cards", () => {
  render(<ModelsPage />);

  expect(screen.getByText("Session stack preview")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Live stack" }));

  expect(writeSessionPreferences).toHaveBeenCalledWith(
    expect.objectContaining({
      llmModel: "gpt-realtime-mini",
      llmProvider: "openai-realtime",
      ttsModel: "gpt-realtime-mini",
      ttsProvider: "openai-realtime",
    })
  );
});
