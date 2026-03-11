"use client";

import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { getCurrentFirebaseUser } from "./firebase_auth";
import { getFirebaseFirestore } from "./firebase_client";
import type {
  PersistedLessonArchiveEntry,
  PersistedLessonThread,
  PersistedLessonThreadStore,
} from "./lesson_thread_store";

const LESSON_STORE_DOCUMENT_ID = "default";

function lessonStoreRef() {
  const db = getFirebaseFirestore();
  const user = getCurrentFirebaseUser();
  if (!db || !user) {
    return null;
  }

  return doc(db, "users", user.uid, "lessonStores", LESSON_STORE_DOCUMENT_ID);
}

async function writeFirebaseStore(store: PersistedLessonThreadStore) {
  const ref = lessonStoreRef();
  if (!ref) {
    return null;
  }

  await setDoc(ref, {
    ...store,
    updatedAt: new Date().toISOString(),
  });
  return store;
}

export async function fetchFirebaseLessonStore() {
  const ref = lessonStoreRef();
  if (!ref) {
    return null;
  }

  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as PersistedLessonThreadStore;
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

export async function fetchFirebaseArchivedLessonThread(lessonId: string) {
  const store = await fetchFirebaseLessonStore();
  return store?.archive.find((entry) => entry.id === lessonId)?.thread ?? null;
}
