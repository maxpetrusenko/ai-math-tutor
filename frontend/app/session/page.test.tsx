import { readFileSync } from "node:fs";

import React from "react";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  tutorSession: vi.fn<(props: { initialAvatarProviderId?: string }) => React.JSX.Element>(() => <div>Tutor Session Stub</div>),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("../../components/TutorSession", () => ({
  TutorSession: (props: { initialAvatarProviderId?: string }) => mocks.tutorSession(props),
}));

import Page from "./page";

beforeEach(() => {
  mocks.cookies.mockReset();
  mocks.tutorSession.mockClear();
});

test("session page stays server rendered so next headers cookies can be used", () => {
  const source = readFileSync("app/session/page.tsx", "utf8");

  expect(source).not.toContain("\"use client\"");
});

test("session page renders the tutor session with the saved avatar cookie", async () => {
  mocks.cookies.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "human-threejs-3d" }),
  });

  render(await Page());

  expect(screen.getByText("Tutor Session Stub")).toBeInTheDocument();
  expect(mocks.tutorSession).toHaveBeenCalledWith({ initialAvatarProviderId: "human-threejs-3d" });
});
