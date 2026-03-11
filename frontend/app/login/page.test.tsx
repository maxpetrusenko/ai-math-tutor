import React from "react";
import { render, screen } from "@testing-library/react";

import LoginPage from "./page";

vi.mock("../../lib/firebase_auth", () => ({
  FIREBASE_AUTH_NOT_CONFIGURED_MESSAGE:
    "Firebase auth is not configured on this dev server. Set FIREBASE_WEBAPP_CONFIG in .env.local and restart bash scripts/dev.sh.",
  useFirebaseAuth: () => ({
    authReady: true,
    firebaseEnabled: false,
    signInWithGoogle: vi.fn(),
    user: null,
  }),
}));

test("login page surfaces firebase auth misconfiguration instead of silent google sign in noop", () => {
  render(<LoginPage />);

  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  expect(
    screen.getByRole("alert", {
      name: "",
    })
  ).toHaveTextContent("Firebase auth is not configured on this dev server.");
});
