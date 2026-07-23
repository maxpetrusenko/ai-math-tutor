import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("../../lib/avatar_preference", () => ({
  readAvatarProviderPreference: () => "sage-svg-2d",
  writeAvatarProviderPreference: vi.fn(),
}));

vi.mock("../../components/TalkingHeadAvatar", () => ({
  TalkingHeadAvatar: () => <div data-testid="talking-head" />,
}));

test("avatar page migrates a legacy preference to the local TalkingHead tutor", async () => {
  const { default: AvatarPage } = await import("./page");
  render(<AvatarPage />);

  expect(screen.getByText("Choose Your Tutor")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Nerdy Tutor" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Sage" })).not.toBeInTheDocument();
  expect(screen.getAllByText("Hello, ready to learn?").length).toBeGreaterThan(0);
});

test("managed avatars are removed from the product menu", async () => {
  const { default: AvatarPage } = await import("./page");
  render(<AvatarPage />);

  expect(screen.queryByRole("button", { name: /live avatars/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /simli tutor/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /heygen tutor/i })).not.toBeInTheDocument();
  expect(screen.queryByTestId("avatar-surface-managed")).not.toBeInTheDocument();
});

test("local picker exposes only the replacement tutor", async () => {
  const { default: AvatarPage } = await import("./page");
  render(<AvatarPage />);

  expect(screen.getAllByTestId("avatar-surface-talkinghead")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: /local tutor/i })).not.toBeInTheDocument();
});
