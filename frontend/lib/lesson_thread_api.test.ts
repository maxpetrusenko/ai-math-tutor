import { afterEach, beforeEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_SESSION_WS_URL: "ws://127.0.0.1:8000/ws/session",
    NODE_ENV: "development",
  };
});

afterEach(() => {
  vi.useRealTimers();
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

test("lesson thread api aborts slow backend requests", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn(
    (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {} as Window & typeof globalThis);

  const { fetchLessonStore } = await import("./lesson_thread_api");

  const request = fetchLessonStore();
  await Promise.resolve();

  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  const signal = init?.signal as AbortSignal | undefined;
  expect(signal).toBeDefined();
  expect(signal?.aborted).toBe(false);

  await vi.advanceTimersByTimeAsync(5000);

  expect(signal?.aborted).toBe(true);
  await expect(request).resolves.toBeNull();
});

test("lesson thread api calls the backend lesson store", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    async json() {
      return { activeThread: null, archive: [] };
    },
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {} as Window & typeof globalThis);

  const { fetchLessonStore } = await import("./lesson_thread_api");

  await expect(fetchLessonStore()).resolves.toEqual({ activeThread: null, archive: [] });
  expect(fetchMock).toHaveBeenCalledWith(
    "http://127.0.0.1:8000/api/lessons",
    expect.objectContaining({
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      signal: expect.any(AbortSignal),
    })
  );
});

test("learning analytics api reuses the lesson backend", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    async json() {
      return {
        achievements: [],
        completedLessons: 2,
        currentStreakDays: 3,
        estimatedMinutes: 18,
        masteryScore: 72,
        practiceDays: 4,
        recentLessonTitles: ["Linear Equations"],
        strongestSubject: "Math",
        tutorTurns: 6,
      };
    },
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {} as Window & typeof globalThis);

  const { fetchLearningAnalytics } = await import("./lesson_thread_api");

  await expect(fetchLearningAnalytics()).resolves.toEqual({
    achievements: [],
    completedLessons: 2,
    currentStreakDays: 3,
    estimatedMinutes: 18,
    masteryScore: 72,
    practiceDays: 4,
    recentLessonTitles: ["Linear Equations"],
    strongestSubject: "Math",
    tutorTurns: 6,
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "http://127.0.0.1:8000/api/lessons/analytics",
    expect.objectContaining({
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      signal: expect.any(AbortSignal),
    })
  );
});
