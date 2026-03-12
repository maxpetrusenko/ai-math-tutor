import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/avatar_preference", () => ({
  readAvatarProviderPreference: () => "sage-svg-2d",
  writeAvatarProviderPreference: vi.fn(),
}));

test("avatar page highlights the selected tutor spotlight", async () => {
  const { default: AvatarPage } = await import("./page");
  render(<AvatarPage />);

  expect(screen.getByText("Choose Your Tutor")).toBeInTheDocument();
  expect(screen.getByText("Calm explanations")).toBeInTheDocument();
  expect(screen.getAllByText("Sage").length).toBeGreaterThan(0);
  expect(screen.queryByRole("link", { name: "Start session" })).not.toBeInTheDocument();
  expect(screen.getAllByText("Hello, ready to learn?").length).toBeGreaterThan(0);
});

test("managed avatars keep the picker lightweight", async () => {
  const { default: AvatarPage } = await import("./page");
  render(<AvatarPage />);

  fireEvent.click(screen.getByRole("button", { name: /live avatars/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: /simli tutor/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /simli tutor/i }));

  expect(screen.queryByTestId("managed-avatar-session")).not.toBeInTheDocument();
  expect(screen.queryByText("Local preview only here. The real live camera stage starts in the tutor session.")).not.toBeInTheDocument();
  expect(screen.getAllByTestId("avatar-surface-managed").length).toBeGreaterThan(0);
});

test("hovering a picker card wakes the tutor preview", async () => {
  const { default: AvatarPage } = await import("./page");
  render(<AvatarPage />);

  const novaCard = screen.getByRole("button", { name: /nova/i });
  fireEvent.mouseEnter(novaCard);

  await waitFor(() => expect(screen.getAllByText("Hello, ready to learn?").length).toBeGreaterThan(1));
});
