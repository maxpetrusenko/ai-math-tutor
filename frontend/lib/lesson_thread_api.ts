import type { PersistedLessonArchiveEntry, PersistedLessonThreadStore, PersistedLessonThread } from "./lesson_thread_store";
import { getCurrentFirebaseIdToken } from "./firebase_auth";
import { getFirebaseAuthClient } from "./firebase_client";

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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const baseUrl = resolveLessonApiUrl();
  if (!baseUrl || typeof window === "undefined" || typeof fetch !== "function") {
    return null;
  }

  try {
    const idToken = await getCurrentFirebaseIdToken();
    if (!idToken && getFirebaseAuthClient()) {
      return null;
    }
    const response = await fetch(path ? `${baseUrl}${path}` : baseUrl, {
      credentials: "include",
      headers: {
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        "Content-Type": "application/json",
      },
      ...init,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
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

export async function fetchArchivedLessonThread(lessonId: string) {
  return requestJson<PersistedLessonThread>(`/archive/${lessonId}`);
}
