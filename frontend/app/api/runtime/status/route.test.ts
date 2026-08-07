import { afterEach, beforeEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test("runtime status route reports revision and session target", async () => {
  process.env.APP_REVISION = "sha-runtime-image";
  process.env.K_REVISION = "ai-math-tutor-build-2026-03-11-011";
  process.env.K_SERVICE = "ai-math-tutor-frontend";
  process.env.NEXT_PUBLIC_SESSION_WS_URL = "wss://example.com/ws/session";

  const { GET } = await import("./route");
  const response = await GET();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    revision: "sha-runtime-image",
    service: "ai-math-tutor-frontend",
    sessionWsUrl: "wss://example.com/ws/session",
  });
});

test("runtime status route reports missing session target cleanly", async () => {
  const { GET } = await import("./route");
  const response = await GET();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    revision: null,
    service: null,
    sessionWsUrl: null,
  });
});
