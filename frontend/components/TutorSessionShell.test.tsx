import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/session",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { TutorSession } from "./TutorSession";

test("renders the tutor-style session shell", async () => {
  window.history.replaceState({}, "", "/session?lesson=3");

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

  expect(screen.getAllByText("Session").length).toBeGreaterThan(0);
  expect(screen.getByText("Nerdy AI Tutor")).toBeInTheDocument();
  expect(screen.getByText("Open ended session for questions, drills, and follow ups.")).toBeInTheDocument();
  expect(screen.queryByLabelText("Session setup links")).not.toBeInTheDocument();
  expect(screen.queryByTestId("latency-strip")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Subject")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("LLM provider")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Learning preference")).not.toBeInTheDocument();
  expect(screen.queryByTestId("session-chat")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByText("Intro to Fractions").length).toBeGreaterThan(0));
  expect(screen.queryByText("Ready for a new lesson?")).not.toBeInTheDocument();
  expect(screen.getAllByText("Sage").length).toBeGreaterThan(0);
  expect(screen.queryByText("Patient guide")).not.toBeInTheDocument();
  expect(screen.queryByText("Grade 3-5")).not.toBeInTheDocument();
  expect(screen.getByText("Tutor approach")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("What common denominator can we use for 1/4 and 2/3?")).toBeInTheDocument();
  expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  expect(screen.getAllByText("Add fractions with unlike denominators").length).toBeGreaterThan(0);
  expect(screen.getAllByText("What common denominator can we use for 1/4 and 2/3?").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Open session history" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open session logs" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start new session" })).toBeInTheDocument();
});
