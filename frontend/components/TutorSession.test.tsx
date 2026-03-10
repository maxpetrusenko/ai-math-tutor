import React from "react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TutorSession } from "./TutorSession";
import { BrowserAudioCapture } from "../lib/audio_capture";

vi.mock("./Avatar3D", () => ({
  Avatar3D: () => <div>Avatar (3D)</div>,
}));

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
        }
      }}
    />
  );

  expect(screen.getByText("Tutor State")).toBeInTheDocument();
  expect(screen.getByText("Latency")).toBeInTheDocument();
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
  fireEvent.click(screen.getByRole("button", { name: "Run Demo Turn" }));

  await waitFor(() =>
    expect(screen.getByText("Nice start. What should you isolate first?")).toBeInTheDocument()
  );
  expect(screen.getByText("120 ms")).toBeInTheDocument();
  expect(screen.getAllByText("speaking").length).toBeGreaterThanOrEqual(2);
  expect(requests[0]).toMatchObject({
    studentText: "I don't understand how to solve for x.",
    subject: "science",
    gradeBand: "9-10"
  });
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
        }
      }}
    />
  );

  expect(screen.getByTestId("avatar-surface-2d")).toBeInTheDocument();
  expect(screen.getByTestId("avatar-mode-css-2d")).toHaveAttribute("data-selected", "true");

  fireEvent.click(screen.getByRole("button", { name: "3D Three.js" }));

  await waitFor(() => expect(screen.getByTestId("avatar-surface-3d")).toBeInTheDocument());
  expect(screen.getByRole("heading", { name: "Avatar (3D)" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "3D Three.js" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByTestId("avatar-mode-threejs-3d")).toHaveAttribute("data-selected", "true");

  fireEvent.click(screen.getByRole("button", { name: "2D CSS" }));

  await waitFor(() => expect(screen.getByTestId("avatar-surface-2d")).toBeInTheDocument());
  expect(screen.getByRole("heading", { name: "Avatar" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "2D CSS" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByTestId("avatar-mode-css-2d")).toHaveAttribute("data-selected", "true");
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
    }
  };

  render(<TutorSession transport={transport} />);

  fireEvent.click(screen.getByRole("button", { name: "Run Demo Turn" }));
  await waitFor(() => expect(screen.getAllByText("thinking").length).toBeGreaterThan(0));

  fireEvent.click(screen.getByRole("button", { name: "Interrupt" }));
  await waitFor(() => expect(screen.getAllByText("idle").length).toBeGreaterThan(0));

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
  expect(screen.getAllByText("idle").length).toBeGreaterThan(0);
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
        }
      }}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Run Demo Turn" }));

  await waitFor(() => expect(screen.getByTestId("avatar-surface-3d")).toBeInTheDocument());
  expect(screen.getByTestId("avatar-mode-threejs-3d")).toHaveAttribute("data-selected", "true");
});
