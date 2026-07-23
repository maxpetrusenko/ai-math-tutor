import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { TalkingHeadAvatar } from "./TalkingHeadAvatar";

const talkingHeadMocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  dispose: vi.fn(),
  setFixedValue: vi.fn(),
  setMood: vi.fn(),
  showAvatar: vi.fn().mockResolvedValue(undefined),
  speakAudio: vi.fn(),
  stopSpeaking: vi.fn(),
}));

const originalDevicePixelRatio = window.devicePixelRatio;

vi.mock("@met4citizen/talkinghead", () => ({
  TalkingHead: class {
    lipsync = { en: {} };
    morphs = [{
      morphTargetDictionary: { viseme_PP: 0 },
      morphTargetInfluences: [0.9],
    }];

    constructor(node: HTMLElement, options: unknown) {
      talkingHeadMocks.constructor(node, options);
    }

    dispose = talkingHeadMocks.dispose;
    setFixedValue = talkingHeadMocks.setFixedValue;
    setMood = talkingHeadMocks.setMood;
    showAvatar = talkingHeadMocks.showAvatar;
    speakAudio = talkingHeadMocks.speakAudio;
    stopSpeaking = talkingHeadMocks.stopSpeaking;
  },
}));

vi.mock("@met4citizen/talkinghead/modules/lipsync-en.mjs", () => ({
  LipsyncEn: class {
    preProcessText(text: string) {
      return text;
    }

    wordsToVisemes() {
      return { durations: [1, 1, 1], times: [0, 1, 2], visemes: ["PP", "aa", "FF"] };
    }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  talkingHeadMocks.showAvatar.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: originalDevicePixelRatio,
  });
  vi.unstubAllGlobals();
});

test("loads the licensed model and drives native English visemes", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  const { rerender, unmount } = render(
    <TalkingHeadAvatar
      frame={{ caption: "Ready", mouthOpen: 0.12, state: "idle" }}
      modelUrl="/avatars/nerdy-tutor.glb?v=7a05c998"
      variant="hero"
    />
  );

  await waitFor(() => expect(talkingHeadMocks.showAvatar).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByTestId("talking-head")).toHaveAttribute("data-load-ms"));
  expect(screen.getByTestId("talking-head")).toHaveAttribute("data-load-state", "ready");
  expect(talkingHeadMocks.stopSpeaking).toHaveBeenCalledTimes(1);

  rerender(
    <TalkingHeadAvatar
      frame={{ caption: "Ready", mouthOpen: 0.12, state: "idle" }}
      modelUrl="/avatars/nerdy-tutor.glb?v=7a05c998"
      variant="hero"
    />
  );
  expect(talkingHeadMocks.stopSpeaking).toHaveBeenCalledTimes(1);

  expect(talkingHeadMocks.constructor).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ lipsyncModules: [] }),
  );

  expect(talkingHeadMocks.showAvatar).toHaveBeenCalledWith(
    expect.objectContaining({
      body: "F",
      url: "/avatars/nerdy-tutor.glb?v=7a05c998",
    })
  );

  rerender(
    <TalkingHeadAvatar
      frame={{ activeWord: "factor", caption: "Speaking: factor", mouthOpen: 0.84, state: "speaking" }}
      modelUrl="/avatars/nerdy-tutor.glb?v=7a05c998"
      speechCue={{ id: "turn-1", words: ["baby", "five"], wtimes: [0, 180], wdurations: [160, 160] }}
      variant="hero"
    />
  );

  await waitFor(() => expect(talkingHeadMocks.setFixedValue).toHaveBeenCalledWith(
    "viseme_PP",
    expect.any(Number),
    0,
  ));
  expect(talkingHeadMocks.speakAudio).not.toHaveBeenCalled();
  expect(screen.getByTestId("talking-head")).toHaveAttribute("data-avatar-state", "speaking");
  expect(screen.getByTestId("talking-head")).toHaveAttribute("data-active-word", "factor");
  expect(screen.getByTestId("talking-head")).toHaveAttribute("data-lipsync-mode", "viseme");
  expect(screen.getByTestId("talking-head")).toHaveAttribute("data-viseme-word-count", "2");
  await waitFor(() => expect(screen.getByTestId("talking-head")).toHaveAttribute("data-active-visemes", "PP"));
  await waitFor(() => expect(screen.getByTestId("talking-head")).toHaveAttribute("data-observed-visemes", "PP"));

  unmount();
  expect(talkingHeadMocks.dispose).toHaveBeenCalled();
});

test("caps the effective renderer ratio on high-density mobile displays", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: 3,
  });

  render(
    <TalkingHeadAvatar
      frame={{ caption: "Ready", mouthOpen: 0, state: "idle" }}
      modelUrl="/avatars/nerdy-tutor.glb?v=7a05c998"
      variant="hero"
    />
  );

  await waitFor(() => expect(talkingHeadMocks.constructor).toHaveBeenCalled());
  expect(talkingHeadMocks.constructor).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ modelPixelRatio: 0.5 })
  );
});

test("shows a useful load error and retries the same model", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  const onError = vi.fn();
  talkingHeadMocks.showAvatar
    .mockRejectedValueOnce(new Error("bad model"))
    .mockResolvedValueOnce(undefined);

  render(
    <TalkingHeadAvatar
      frame={{ caption: "Ready", mouthOpen: 0, state: "idle" }}
      modelUrl="/avatars/nerdy-tutor.glb?v=7a05c998"
      onError={onError}
      variant="hero"
    />
  );

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Avatar could not load."));
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "bad model" }));

  fireEvent.click(screen.getByRole("button", { name: "Retry avatar" }));

  await waitFor(() => expect(talkingHeadMocks.showAvatar).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});
