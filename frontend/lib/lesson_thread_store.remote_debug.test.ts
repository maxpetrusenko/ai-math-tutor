import { beforeEach, expect, test, vi } from "vitest";

const fetchArchivedLessonThread = vi.fn();
const fetchLessonStore = vi.fn();
const saveActiveLessonThread = vi.fn();
const archiveRemoteLessonThread = vi.fn();
const clearRemoteActiveLessonThread = vi.fn();
const clearRemoteArchivedLessonThreads = vi.fn();

const fetchFirebaseLessonStore = vi.fn();
const fetchFirebaseArchivedLessonThread = vi.fn();
const saveFirebaseActiveLessonThread = vi.fn();
const archiveFirebaseLessonThread = vi.fn();
const clearFirebaseActiveLessonThread = vi.fn();
const clearFirebaseArchivedLessonThreads = vi.fn();

vi.mock("./lesson_thread_api", () => ({
  archiveRemoteLessonThread,
  clearRemoteActiveLessonThread,
  clearRemoteArchivedLessonThreads,
  fetchArchivedLessonThread,
  fetchLessonStore,
  saveActiveLessonThread,
}));

vi.mock("./firebase_lessons", () => ({
  archiveFirebaseLessonThread,
  clearFirebaseActiveLessonThread,
  clearFirebaseArchivedLessonThreads,
  fetchFirebaseArchivedLessonThread,
  fetchFirebaseLessonStore,
  saveFirebaseActiveLessonThread,
}));

beforeEach(() => {
  window.localStorage.clear();
  fetchArchivedLessonThread.mockReset();
  fetchLessonStore.mockReset();
  saveActiveLessonThread.mockReset();
  archiveRemoteLessonThread.mockReset();
  clearRemoteActiveLessonThread.mockReset();
  clearRemoteArchivedLessonThreads.mockReset();
  fetchFirebaseLessonStore.mockReset();
  fetchFirebaseArchivedLessonThread.mockReset();
  saveFirebaseActiveLessonThread.mockReset();
  archiveFirebaseLessonThread.mockReset();
  clearFirebaseActiveLessonThread.mockReset();
  clearFirebaseArchivedLessonThreads.mockReset();
});

test("hydrateLessonThreadStore synthesizes debug for raw remote active threads", async () => {
  fetchFirebaseLessonStore.mockResolvedValue(null);
  fetchLessonStore.mockResolvedValue({
    activeThread: {
      avatarProviderId: "sage-svg-2d",
      conversation: [{ id: "1", transcript: "raw question", tutorText: "raw answer" }],
      gradeBand: "6-8",
      llmModel: "gpt-realtime-mini",
      llmProvider: "openai-realtime",
      preference: "",
      sessionId: "raw-session",
      studentPrompt: "",
      subject: "math",
      transcript: "raw question",
      ttsModel: "gpt-realtime-mini",
      ttsProvider: "openai-realtime",
      tutorText: "raw answer",
      version: 1,
    },
    archive: [],
    version: 2,
  });

  const { hydrateLessonThreadStore } = await import("./lesson_thread_store");
  const store = await hydrateLessonThreadStore();

  expect(store.activeThread?.conversation[0]?.debug).toBeDefined();
  expect(store.activeThread?.conversation[0]?.debug?.derivedFromLegacyTurn).toBe(true);
});

test("refreshArchivedLessonThread synthesizes debug for raw remote archived threads", async () => {
  const {
    archivePersistedLessonThread,
    refreshArchivedLessonThread,
    readArchivedLessonThread,
  } = await import("./lesson_thread_store");

  const archived = archivePersistedLessonThread({
    avatarProviderId: "sage-svg-2d",
    conversation: [{ id: "1", transcript: "stored", tutorText: "stored answer" }],
    gradeBand: "6-8",
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    preference: "",
    sessionId: "archived-session",
    studentPrompt: "",
    subject: "math",
    transcript: "stored",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    tutorText: "stored answer",
    version: 1,
  })[0];

  fetchFirebaseArchivedLessonThread.mockResolvedValue(null);
  fetchArchivedLessonThread.mockResolvedValue({
    avatarProviderId: "sage-svg-2d",
    conversation: [{ id: "1", transcript: "remote archived", tutorText: "remote reply" }],
    gradeBand: "6-8",
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    preference: "",
    sessionId: "remote-archived-session",
    studentPrompt: "",
    subject: "math",
    transcript: "remote archived",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    tutorText: "remote reply",
    version: 1,
  });

  const thread = await refreshArchivedLessonThread(archived.id);

  expect(thread?.conversation[0]?.debug).toBeDefined();
  expect(thread?.conversation[0]?.debug?.derivedFromLegacyTurn).toBe(true);
  expect(readArchivedLessonThread(archived.id)?.conversation[0]?.debug?.derivedFromLegacyTurn).toBe(true);
});
