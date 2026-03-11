import { afterEach, beforeEach, vi } from "vitest";

const getCurrentFirebaseIdToken = vi.fn<() => Promise<string | null>>();
const getFirebaseAuthClient = vi.fn<() => object | null>();

vi.mock("./firebase_auth", () => ({
  getCurrentFirebaseIdToken,
}));

vi.mock("./firebase_client", () => ({
  getFirebaseAuthClient,
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_SESSION_WS_URL: "ws://127.0.0.1:8000/ws/session",
    NODE_ENV: "development",
  };
  getCurrentFirebaseIdToken.mockResolvedValue(null);
  getFirebaseAuthClient.mockReturnValue(null);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

test("lesson thread api skips pre-auth fetches when firebase auth is enabled but token is missing", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {} as Window & typeof globalThis);
  getFirebaseAuthClient.mockReturnValue({ currentUser: null });

  const { fetchLessonStore } = await import("./lesson_thread_api");

  await expect(fetchLessonStore()).resolves.toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("lesson thread api forwards bearer token once firebase auth is ready", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    async json() {
      return { activeThread: null, archive: [] };
    },
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {} as Window & typeof globalThis);
  getFirebaseAuthClient.mockReturnValue({ currentUser: { uid: "user-1" } });
  getCurrentFirebaseIdToken.mockResolvedValue("firebase-id-token");

  const { fetchLessonStore } = await import("./lesson_thread_api");

  await expect(fetchLessonStore()).resolves.toEqual({ activeThread: null, archive: [] });
  expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/lessons", {
    credentials: "include",
    headers: {
      Authorization: "Bearer firebase-id-token",
      "Content-Type": "application/json",
    },
  });
});
