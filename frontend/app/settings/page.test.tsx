import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  clearLessonHistory,
  exportLearnerSnapshot,
  resetSessionPreferences,
  writeSessionPreferences,
} = vi.hoisted(() => ({
  clearLessonHistory: vi.fn().mockResolvedValue(undefined),
  exportLearnerSnapshot: vi.fn(() => ({
    activeThread: null,
    archive: [],
    avatarProviderId: "sage-svg-2d",
    exportedAt: "2026-03-12T00:00:00.000Z",
    preferences: {
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
    },
  })),
  resetSessionPreferences: vi.fn(() => ({
    audioVolume: 1,
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
  })),
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
  resetSessionPreferences,
  writeSessionPreferences,
}));

vi.mock("../../lib/account_snapshot", () => ({
  clearLessonHistory,
  exportLearnerSnapshot,
}));

import SettingsPage from "./page";

test("settings shows a current setup summary for the learner", () => {
  render(<SettingsPage />);

  expect(screen.getByText("Current setup")).toBeInTheDocument();
  expect(screen.getAllByText("Math").length).toBeGreaterThan(0);
  expect(screen.getAllByText("3-5").length).toBeGreaterThan(0);
  expect(screen.getAllByText("English").length).toBeGreaterThan(0);
});

test("settings owns the session brain controls", () => {
  render(<SettingsPage />);

  expect(screen.getAllByText("Session brain").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("Session LLM provider")).toHaveValue("gemini");
  expect(screen.getByLabelText("Session LLM model")).toHaveValue("gemini-3-flash-preview");

  fireEvent.change(screen.getByLabelText("Session LLM provider"), {
    target: { value: "openai-realtime" },
  });

  expect(writeSessionPreferences).toHaveBeenCalledWith(expect.objectContaining({
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
  }));
});

test("settings exposes learner data export and reset actions", async () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:learner-export"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  const createObjectUrlSpy = vi.mocked(URL.createObjectURL);
  const revokeObjectUrlSpy = vi.mocked(URL.revokeObjectURL);
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

  render(<SettingsPage />);

  fireEvent.click(screen.getByRole("button", { name: "Export learner data" }));
  expect(exportLearnerSnapshot).toHaveBeenCalled();
  expect(createObjectUrlSpy).toHaveBeenCalled();
  expect(clickSpy).toHaveBeenCalled();
  expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:learner-export");

  fireEvent.click(screen.getByRole("button", { name: "Clear saved lessons" }));
  expect(clearLessonHistory).toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved lesson history cleared on this device."));

  fireEvent.click(screen.getByRole("button", { name: "Reset tutor defaults" }));
  expect(resetSessionPreferences).toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Tutor defaults reset."));
  clickSpy.mockRestore();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: originalCreateObjectUrl,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: originalRevokeObjectUrl,
  });
});
