import { afterEach, beforeEach, expect, test, vi } from "vitest";

const getCurrentFirebaseIdToken = vi.fn<() => Promise<string | null>>();

vi.mock("./firebase_auth", () => ({
  getCurrentFirebaseIdToken,
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "development",
  };
  getCurrentFirebaseIdToken.mockResolvedValue("firebase-id-token");
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

test("livekit avatar bootstrap uses same-origin https fallback in browser", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    async json() {
      return {
        participant_identity: "web-1",
        provider: "simli",
        provider_id: "simli-b97a7777-live",
        room_metadata: {},
        room_name: "room-1",
        token: "token-1",
        url: "wss://example.livekit.cloud",
      };
    },
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {
    location: {
      origin: "https://ai-math-tutor.example.com",
      hostname: "ai-math-tutor.example.com",
    },
  } as Window & typeof globalThis);

  const { createLiveKitAvatarSession } = await import("./livekit_avatar_session");

  await createLiveKitAvatarSession("simli-b97a7777-live", "Student");

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("https://ai-math-tutor.example.com/api/avatars/livekit/session", {
    method: "POST",
    headers: {
      authorization: "Bearer firebase-id-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      avatarProviderId: "simli-b97a7777-live",
      participantName: "Student",
    }),
  });
});

test("livekit avatar bootstrap stops on backend http errors instead of retrying localhost fallbacks", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: false,
    status: 503,
    async json() {
      return { detail: "managed avatar not ready" };
    },
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {
    location: {
      origin: "https://ai-math-tutor.example.com",
      hostname: "ai-math-tutor.example.com",
    },
  } as Window & typeof globalThis);

  const { createLiveKitAvatarSession } = await import("./livekit_avatar_session");

  await expect(createLiveKitAvatarSession("simli-b97a7777-live", "Student")).rejects.toThrow("managed avatar not ready");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("livekit avatar bootstrap prefers the backend on port 8000 for localhost runs", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    async json() {
      return {
        participant_identity: "web-1",
        provider: "simli",
        provider_id: "simli-b97a7777-live",
        room_metadata: {},
        room_name: "room-1",
        token: "token-1",
        url: "wss://example.livekit.cloud",
      };
    },
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {
    location: {
      origin: "http://127.0.0.1:3000",
      hostname: "127.0.0.1",
    },
  } as Window & typeof globalThis);

  const { createLiveKitAvatarSession } = await import("./livekit_avatar_session");

  await createLiveKitAvatarSession("simli-b97a7777-live", "Student");

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/avatars/livekit/session", expect.any(Object));
});
