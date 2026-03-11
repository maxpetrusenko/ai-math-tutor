import { afterEach, beforeEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test("firebase config route serves private runtime JSON config", async () => {
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
    apiKey: "runtime-key",
    appId: "runtime-app",
    authDomain: "runtime.firebaseapp.com",
    messagingSenderId: "123",
    projectId: "runtime-project",
    storageBucket: "runtime.appspot.com",
  });
});

test("firebase config route falls back to public firebase env keys", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "public-key";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "public.firebaseapp.com";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "public-project";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "public.appspot.com";
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "456";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "public-app";

  const { GET } = await import("./route");
  const response = await GET();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    apiKey: "public-key",
    appId: "public-app",
    authDomain: "public.firebaseapp.com",
    messagingSenderId: "456",
    projectId: "public-project",
    storageBucket: "public.appspot.com",
  });
});

test("firebase config route returns 204 when firebase config is unavailable", async () => {
  delete process.env.FIREBASE_WEBAPP_CONFIG;
  delete process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG;
  delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  delete process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  delete process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  const { GET } = await import("./route");
  const response = await GET();

  expect(response.status).toBe(204);
});
