import React from "react";
import { render, screen } from "@testing-library/react";

import { AvatarProvider } from "./AvatarProvider";

vi.mock("./TalkingHeadAvatar", () => ({
  TalkingHeadAvatar: ({ frame, modelUrl }: { frame: { mouthOpen: number; state: string }; modelUrl: string }) => (
    <div
      data-avatar-state={frame.state}
      data-model-url={modelUrl}
      data-mouth-open={frame.mouthOpen}
      data-testid="talking-head"
    />
  ),
}));

test("local avatar renders the TalkingHead adapter with measurable mouth state", () => {
  render(
    <AvatarProvider
      avatarId="nerdy-talkinghead-3d"
      energy={0.8}
      nowMs={80}
      state="speaking"
      subtitle="Hint mode active"
      timestamps={[{ endMs: 120, startMs: 0, word: "factor" }]}
      variant="hero"
    />
  );

  expect(screen.getByTestId("avatar-surface-talkinghead")).toBeInTheDocument();
  expect(screen.getByTestId("talking-head")).toHaveAttribute("data-avatar-state", "speaking");
  expect(Number(screen.getByTestId("talking-head").getAttribute("data-mouth-open"))).toBeGreaterThan(0.8);
  expect(screen.getByText("Hint mode active")).toBeInTheDocument();
});

test("legacy local configs migrate to the TalkingHead adapter", () => {
  render(
    <AvatarProvider
      config={{ provider: "threejs", type: "3d", assetRef: "robot" }}
      energy={0.2}
      nowMs={0}
      state="idle"
      timestamps={[]}
    />
  );

  expect(screen.getByTestId("talking-head")).toHaveAttribute(
    "data-model-url",
    "/avatars/nerdy-tutor.glb?v=7a05c998"
  );
});

test("managed avatars render a remote-session placeholder shell when no preview clip exists", () => {
  render(
    <AvatarProvider
      avatarId="heygen-liveavatar-default"
      energy={0.2}
      nowMs={0}
      state="idle"
      subtitle="Remote tutor ready"
      timestamps={[]}
      variant="hero"
    />
  );

  expect(screen.getByTestId("avatar-surface-managed")).toBeInTheDocument();
  expect(screen.getByText("Remote tutor ready")).toBeInTheDocument();
});

test("managed avatars use a local non-room surface in gallery mode", () => {
  render(
    <AvatarProvider
      avatarId="simli-b97a7777-live"
      energy={0.2}
      nowMs={0}
      state="idle"
      subtitle="Hello, ready to learn?"
      timestamps={[]}
      variant="gallery"
    />
  );

  expect(screen.getByTestId("avatar-surface-managed")).toBeInTheDocument();
  expect(document.querySelector(".avatar__managed-gallery-video")).toBeTruthy();
  expect(screen.getByText("Hello, ready to learn?")).toBeInTheDocument();
});
