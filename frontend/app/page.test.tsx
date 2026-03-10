import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("../components/TutorSession", () => ({
  TutorSession: () => <div>Tutor Session Stub</div>,
}));

import Page from "./page";

test("page renders the tutor session entrypoint", () => {
  render(<Page />);

  expect(screen.getByText("Tutor Session Stub")).toBeInTheDocument();
});
