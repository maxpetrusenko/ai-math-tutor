import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { denyStorageAccess } from "../../lib/storage_test_helpers";
import SignupPage from "./page";

beforeEach(() => {
  window.localStorage.clear();
});

function completeSignupFlow(container: HTMLElement) {
  fireEvent.change(screen.getByPlaceholderText("Email address"), {
    target: { value: "learner@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  const birthdayInput = container.querySelector("input[type='date']");
  if (!birthdayInput) {
    throw new Error("birthday input not rendered");
  }
  fireEvent.change(birthdayInput, { target: { value: "2015-01-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Start learning" }));
}

test("completes the signup flow when browser storage is unavailable", () => {
  const restoreStorage = denyStorageAccess();

  try {
    const { container } = render(<SignupPage />);

    completeSignupFlow(container);

    expect(screen.getByText("Profile ready")).toBeInTheDocument();
  } finally {
    restoreStorage();
  }
});

test("records the grade band when browser storage is available", () => {
  const { container } = render(<SignupPage />);

  completeSignupFlow(container);

  expect(window.localStorage.getItem("nerdy_grade_band")).toBeTruthy();
  expect(screen.getByText("Profile ready")).toBeInTheDocument();
});
