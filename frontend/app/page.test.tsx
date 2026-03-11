import React from "react";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  tutorSession: vi.fn<(props: { initialAvatarProviderId?: string }) => React.JSX.Element>(() => <div>Tutor Session Stub</div>),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("../components/TutorSession", () => ({
  TutorSession: (props: { initialAvatarProviderId?: string }) => mocks.tutorSession(props),
}));

import Page from "./page";

beforeEach(() => {
  mocks.cookies.mockReset();
  mocks.tutorSession.mockClear();
});

test("page renders the tutor session entrypoint with the saved avatar cookie", async () => {
  mocks.cookies.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "human-threejs-3d" }),
  });

  render(await Page());

  expect(screen.getByText("Tutor Session Stub")).toBeInTheDocument();
  expect(mocks.tutorSession).toHaveBeenCalledWith({ initialAvatarProviderId: "human-threejs-3d" });
});
