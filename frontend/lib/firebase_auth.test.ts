import { describeFirebaseAuthError } from "./firebase_auth";

test("firebase auth maps unauthorized-domain into an actionable operator message", () => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      hostname: "localhost",
    },
  });

  expect(
    describeFirebaseAuthError({
      code: "auth/unauthorized-domain",
      message: "Firebase: Error (auth/unauthorized-domain).",
    })
  ).toContain("Add `localhost` to Firebase Console -> Authentication -> Settings -> Authorized domains.");
});

test("firebase auth falls back to the raw error message for unrelated failures", () => {
  expect(describeFirebaseAuthError(new Error("popup closed by user"))).toBe("popup closed by user");
});
