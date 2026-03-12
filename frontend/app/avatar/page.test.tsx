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
  expect(screen.getAllByText("Patient guide").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Sage").length).toBeGreaterThan(0);
  expect(screen.getByRole("link", { name: "Start session" })).toHaveAttribute("href", "/session");
  expect(screen.getByText("Warm mentor who explains it clearly.")).toBeInTheDocument();
  expect(screen.getByText("Hello, ready to learn?")).toBeInTheDocument();
});

test("managed avatars keep the picker lightweight", async () => {
  const { default: AvatarPage } = await import("./page");
  render(<AvatarPage />);

  fireEvent.click(screen.getByRole("button", { name: /live avatars/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: /simli tutor/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /simli tutor/i }));

  expect(screen.queryByTestId("managed-avatar-session")).not.toBeInTheDocument();
  expect(screen.getByText("Opens as a live camera stage in the tutor session.")).toBeInTheDocument();
  expect(screen.getAllByTestId("avatar-surface-managed").length).toBeGreaterThan(1);
});
