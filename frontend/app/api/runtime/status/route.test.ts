import { afterEach, beforeEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test("runtime status route reports revision and firebase config readiness", async () => {
  process.env.K_REVISION = "ai-math-tutor-build-2026-03-11-011";
  process.env.K_SERVICE = "ai-math-tutor-frontend";
  process.env.NEXT_PUBLIC_SESSION_WS_URL = "wss://example.com/ws/session";
  process.env.FIREBASE_WEBAPP_CONFIG = JSON.stringify({
    apiKey: "runtime-key",
    appId: "runtime-app",
    authDomain: "runtime.firebaseapp.com",
    messagingSenderId: "123",
    projectId: "runtime-project",
    storageBucket: "runtime.appspot.com",
  });

  const { GET } = await import("./route");
  const response = await GET();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    firebaseConfigReady: true,
    firebaseConfigSource: "FIREBASE_WEBAPP_CONFIG",
    revision: "ai-math-tutor-build-2026-03-11-011",
    service: "ai-math-tutor-frontend",
    sessionWsUrl: "wss://example.com/ws/session",
  });
});

test("runtime status route reports missing firebase config cleanly", async () => {
  delete process.env.FIREBASE_WEBAPP_CONFIG;
  delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  delete process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  delete process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  const { GET } = await import("./route");
  const response = await GET();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    firebaseConfigReady: false,
    firebaseConfigSource: null,
    revision: null,
    service: null,
    sessionWsUrl: null,
  });
});
