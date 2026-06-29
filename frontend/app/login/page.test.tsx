import React from "react";
import { render, screen } from "@testing-library/react";

import LoginPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

test("login page offers local app entry", () => {
  render(<LoginPage />);

  expect(screen.getByRole("button", { name: "Continue to dashboard" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Enter" })).toBeEnabled();
});
