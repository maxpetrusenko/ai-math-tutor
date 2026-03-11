import { afterEach, beforeEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test("firebase client reports disabled when required public env is missing", async () => {
  delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  const module = await import("./firebase_client");

  expect(module.isFirebaseEnabled()).toBe(false);
});

test("firebase client reports enabled when required public env is present", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-key";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "example.firebaseapp.com";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "ai-math-tutor-b39b3";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "ai-math-tutor-b39b3.firebasestorage.app";
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "1234567890";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:1234567890:web:abc";

  const module = await import("./firebase_client");

  expect(module.isFirebaseEnabled()).toBe(true);
});

test("firebase client reports enabled when public JSON config is present", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG = JSON.stringify({
    apiKey: "test-key",
    appId: "test-app",
    authDomain: "example.firebaseapp.com",
    messagingSenderId: "123",
    projectId: "demo-project",
    storageBucket: "demo.appspot.com",
  });

  const module = await import("./firebase_client");

  expect(module.isFirebaseEnabled()).toBe(true);
});

test("firebase client treats a no-content runtime config response as disabled", async () => {
  delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 204,
    async json() {
      return null;
    },
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {} as Window & typeof globalThis);

  const module = await import("./firebase_client");

  await expect(module.ensureFirebaseApp()).resolves.toBeNull();
  expect(fetchMock).toHaveBeenCalledWith("/api/firebase/config", {
    cache: "no-store",
    credentials: "same-origin",
  });
});
