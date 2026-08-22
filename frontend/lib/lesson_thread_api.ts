import type { PersistedLessonArchiveEntry, PersistedLessonThreadStore, PersistedLessonThread } from "./lesson_thread_store";
import type { LearningAnalytics } from "./learning_analytics";

function resolveLessonApiUrl() {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
    return "";
  }

  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_LESSON_API_URL) {
    return process.env.NEXT_PUBLIC_LESSON_API_URL;
  }

  const baseWsUrl =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_SESSION_WS_URL
      ? process.env.NEXT_PUBLIC_SESSION_WS_URL
      : "ws://localhost:8000/ws/session";

  try {
    const url = new URL(baseWsUrl);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = "/api/lessons";
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
}

const DEFAULT_LESSON_API_TIMEOUT_MS = 5000;

function resolveLessonApiTimeoutMs() {
  const rawTimeout = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_LESSON_API_TIMEOUT_MS : undefined;
  const parsedTimeout = Number(rawTimeout);
  return Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_LESSON_API_TIMEOUT_MS;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const baseUrl = resolveLessonApiUrl();
  if (!baseUrl || typeof window === "undefined" || typeof fetch !== "function") {
    return null;
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), resolveLessonApiTimeoutMs()) : undefined;

  try {
    const response = await fetch(path ? `${baseUrl}${path}` : baseUrl, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      ...init,
      signal: init?.signal ?? controller?.signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export async function fetchLessonStore() {
  return requestJson<PersistedLessonThreadStore>("");
}

export async function saveActiveLessonThread(thread: PersistedLessonThread) {
  return requestJson<PersistedLessonThreadStore>("/active", {
    body: JSON.stringify(thread),
    method: "PUT",
  });
}

export async function clearRemoteActiveLessonThread() {
  return requestJson<PersistedLessonThreadStore>("/active", {
    method: "DELETE",
  });
}

export async function archiveRemoteLessonThread(entry: PersistedLessonArchiveEntry) {
  return requestJson<PersistedLessonThreadStore>("/archive", {
    body: JSON.stringify(entry),
    method: "POST",
  });
}

export async function clearRemoteArchivedLessonThreads() {
  return requestJson<PersistedLessonThreadStore>("/archive", {
    method: "DELETE",
  });
}

export async function fetchArchivedLessonThread(lessonId: string) {
  return requestJson<PersistedLessonThread>(`/archive/${lessonId}`);
}

export async function fetchLearningAnalytics() {
  return requestJson<LearningAnalytics>("/analytics");
}
