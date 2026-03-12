import { beforeEach, expect, test, vi } from "vitest";

const getDoc = vi.fn();
const setDoc = vi.fn();
const doc = vi.fn();
const getCurrentFirebaseUser = vi.fn();
const getFirebaseFirestore = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc,
  getDoc,
  setDoc,
}));

vi.mock("./firebase_auth", () => ({
  getCurrentFirebaseUser,
}));

vi.mock("./firebase_firestore", () => ({
  getFirebaseFirestore,
}));

const baseThread = {
  avatarProviderId: "sage-svg-2d",
  conversation: [],
  gradeBand: "6-8",
  llmModel: "gpt-realtime-mini",
  llmProvider: "openai-realtime",
  preference: "",
  sessionId: "lesson-1",
  studentPrompt: "",
  subject: "math",
  transcript: "",
  ttsModel: "gpt-realtime-mini",
  ttsProvider: "openai-realtime",
  tutorText: "",
  version: 1 as const,
};

beforeEach(async () => {
  vi.resetModules();
  doc.mockReset();
  getDoc.mockReset();
  setDoc.mockReset();
  getCurrentFirebaseUser.mockReset();
  getFirebaseFirestore.mockReset();
  doc.mockReturnValue({ path: "users/test/lessonStores/default" });
  getCurrentFirebaseUser.mockReturnValue({ uid: "test-user" });
  getFirebaseFirestore.mockReturnValue({ app: "firebase" });

  const { resetFirebaseLessonTransportStateForTests } = await import("./firebase_lessons");
  resetFirebaseLessonTransportStateForTests();
});

test("disables firebase lesson writes for the session after a blocked-by-client transport error", async () => {
  setDoc.mockRejectedValueOnce(new Error("ERR_BLOCKED_BY_CLIENT"));

  const {
    saveFirebaseActiveLessonThread,
    resetFirebaseLessonTransportStateForTests,
  } = await import("./firebase_lessons");

  await expect(saveFirebaseActiveLessonThread(baseThread, { activeThread: null, archive: [] })).resolves.toBeNull();
  await expect(saveFirebaseActiveLessonThread(baseThread, { activeThread: null, archive: [] })).resolves.toBeNull();

  expect(setDoc).toHaveBeenCalledTimes(1);

  resetFirebaseLessonTransportStateForTests();
});

test("disables firebase lesson reads for the session after a blocked WebChannel error", async () => {
  getDoc.mockRejectedValueOnce(new Error("WebChannel transport errored"));

  const { fetchFirebaseLessonStore } = await import("./firebase_lessons");

  await expect(fetchFirebaseLessonStore()).resolves.toBeNull();
  await expect(fetchFirebaseLessonStore()).resolves.toBeNull();

  expect(getDoc).toHaveBeenCalledTimes(1);
});
