"use client";

import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { getCurrentFirebaseUser } from "./firebase_auth";
import { getFirebaseFirestore } from "./firebase_firestore";
import type {
  PersistedLessonArchiveEntry,
  PersistedLessonThread,
  PersistedLessonThreadStore,
} from "./lesson_thread_store";

const LESSON_STORE_DOCUMENT_ID = "default";
let firebaseLessonTransportBlocked = false;

function isLikelyLocalHost(hostname: string) {
  if (
    hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || hostname.startsWith("10.")
    || hostname.startsWith("192.168.")
  ) {
    return true;
  }

  const private172Match = hostname.match(/^172\.(\d{1,3})\./);
  if (!private172Match) {
    return false;
  }

  const secondOctet = Number.parseInt(private172Match[1] ?? "", 10);
  return secondOctet >= 16 && secondOctet <= 31;
}

function shouldBypassFirebaseLessons() {
  if (typeof window === "undefined" || typeof process === "undefined" || process.env.NODE_ENV !== "development") {
    return false;
  }

  const hostname = window.location.hostname || "";
  return isLikelyLocalHost(hostname);
}

function describeFirebaseLessonError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code ?? "") : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return `${code} ${message}`.trim().toLowerCase();
}

function isBlockedFirebaseLessonTransport(error: unknown) {
  const description = describeFirebaseLessonError(error);
  return (
    description.includes("blocked_by_client")
    || description.includes("webchannel")
    || description.includes("transport errored")
    || description.includes("failed to fetch")
    || description.includes("network error")
    || description.includes("networkerror")
    || description.includes("client is offline")
    || description.includes("unavailable")
  );
}

async function runFirebaseLessonRequest<T>(request: () => Promise<T | null>) {
  if (firebaseLessonTransportBlocked || shouldBypassFirebaseLessons()) {
    return null;
  }

  try {
    return await request();
  } catch (error) {
    if (isBlockedFirebaseLessonTransport(error)) {
      firebaseLessonTransportBlocked = true;
      return null;
    }
    throw error;
  }
}

function lessonStoreRef() {
  const db = getFirebaseFirestore();
  const user = getCurrentFirebaseUser();
  if (!db || !user) {
    return null;
  }

  return doc(db, "users", user.uid, "lessonStores", LESSON_STORE_DOCUMENT_ID);
}

async function writeFirebaseStore(store: PersistedLessonThreadStore) {
  return runFirebaseLessonRequest(async () => {
    const ref = lessonStoreRef();
    if (!ref) {
      return null;
    }

    await setDoc(ref, {
      ...store,
      updatedAt: new Date().toISOString(),
    });
    return store;
  });
}

export async function fetchFirebaseLessonStore() {
  return runFirebaseLessonRequest(async () => {
    const ref = lessonStoreRef();
    if (!ref) {
      return null;
    }

    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data() as PersistedLessonThreadStore;
  });
}

export async function saveFirebaseActiveLessonThread(
  thread: PersistedLessonThread,
  currentStore: PersistedLessonThreadStore
) {
  return writeFirebaseStore({
    ...currentStore,
    activeThread: thread,
  });
}

export async function clearFirebaseActiveLessonThread(currentStore: PersistedLessonThreadStore) {
  return writeFirebaseStore({
    ...currentStore,
    activeThread: null,
  });
}

export async function archiveFirebaseLessonThread(
  entry: PersistedLessonArchiveEntry,
  currentStore: PersistedLessonThreadStore
) {
  return writeFirebaseStore({
    ...currentStore,
    archive: [
      entry,
      ...currentStore.archive.filter((item) => item.id !== entry.id),
    ].slice(0, 8),
  });
}

export async function clearFirebaseArchivedLessonThreads(currentStore: PersistedLessonThreadStore) {
  return writeFirebaseStore({
    ...currentStore,
    archive: [],
  });
}

export async function fetchFirebaseArchivedLessonThread(lessonId: string) {
  const store = await fetchFirebaseLessonStore();
  return store?.archive.find((entry) => entry.id === lessonId)?.thread ?? null;
}

export function resetFirebaseLessonTransportStateForTests() {
  firebaseLessonTransportBlocked = false;
}
