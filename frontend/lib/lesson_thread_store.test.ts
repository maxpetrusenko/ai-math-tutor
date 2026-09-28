import {
  archivePersistedLessonThread,
  clearPersistedLessonThread,
  hydrateLessonThreadStore,
  listArchivedLessonThreads,
  persistActiveLessonThread,
  readPersistedLessonThread,
  writePersistedLessonThread,
} from "./lesson_thread_store";
import { denyStorageAccess, failStorageWrites } from "./storage_test_helpers";
import type { PersistedLessonThread } from "./lesson_thread_store";

function buildLessonThread(
  sessionId: string,
  overrides: Partial<PersistedLessonThread> = {}
): PersistedLessonThread {
  return {
    avatarProviderId: "sage-svg-2d",
    conversation: [],
    gradeBand: "6-8",
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    preference: "",
    sessionId,
    studentPrompt: "",
    subject: "math",
    transcript: "",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    tutorText: "",
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  clearPersistedLessonThread();
});

test("preserves lesson state in persisted active lesson threads", () => {
  writePersistedLessonThread({
    avatarProviderId: "sage-svg-2d",
    conversation: [],
    gradeBand: "3-5",
    lessonState: {
      currentStepIndex: 0,
      currentTask: "Add fractions with unlike denominators",
      lessonId: 3,
      lessonTitle: "Intro to Fractions",
      nextQuestion: "What common denominator can we use for 1/4 and 2/3?",
      program: [
        "Understand what the fractions represent",
        "Add fractions with unlike denominators",
        "Check the answer with one more example",
      ],
      startedFromCatalog: true,
    },
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    preference: "",
    sessionId: "lesson-progress-1",
    studentPrompt: "",
    subject: "math",
    transcript: "",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    tutorText: "",
    version: 1,
  });

  expect(readPersistedLessonThread()).toMatchObject({
    lessonState: {
      currentTask: "Add fractions with unlike denominators",
      lessonTitle: "Intro to Fractions",
      nextQuestion: "What common denominator can we use for 1/4 and 2/3?",
    },
  });
});

test("archives use lesson titles when lesson progress exists", () => {
  archivePersistedLessonThread({
    avatarProviderId: "sage-svg-2d",
    conversation: [
      { id: "1", transcript: "lets learn fractions", tutorText: "start here" },
    ],
    gradeBand: "3-5",
    lessonState: {
      currentStepIndex: 0,
      currentTask: "Add fractions with unlike denominators",
      lessonId: 3,
      lessonTitle: "Intro to Fractions",
      nextQuestion: "What common denominator can we use for 1/4 and 2/3?",
      program: [
        "Understand what the fractions represent",
        "Add fractions with unlike denominators",
        "Check the answer with one more example",
      ],
      startedFromCatalog: true,
    },
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    preference: "",
    sessionId: "lesson-progress-2",
    studentPrompt: "lets learn fractions",
    subject: "math",
    transcript: "lets learn fractions",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    tutorText: "start here",
    version: 1,
  });

  expect(listArchivedLessonThreads()[0]).toMatchObject({
    title: "Intro to Fractions",
  });
});

test("normalizes duplicate persisted conversation ids on read", () => {
  writePersistedLessonThread({
    avatarProviderId: "sage-svg-2d",
    conversation: [
      { id: "1", transcript: "Persist this lesson", tutorText: "reply 1" },
      { id: "1", transcript: "Persist this lesson again", tutorText: "reply 2" },
    ],
    gradeBand: "6-8",
    llmModel: "gpt-realtime-mini",
    llmProvider: "openai-realtime",
    preference: "",
    sessionId: "lesson-duplicate-ids",
    studentPrompt: "",
    subject: "math",
    transcript: "",
    ttsModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    tutorText: "",
    version: 1,
  });

  expect(readPersistedLessonThread()?.conversation.map((turn) => turn.id)).toEqual(["1", "1-2"]);
});

test("survives unavailable browser storage when persisting the active thread", () => {
  const restoreStorage = denyStorageAccess();

  try {
    expect(() => writePersistedLessonThread(buildLessonThread("blocked-storage"))).not.toThrow();
    expect(readPersistedLessonThread()).toBeNull();
  } finally {
    restoreStorage();
  }
});

test("survives quota errors when persisting lesson threads", () => {
  const restoreStorage = failStorageWrites();

  try {
    expect(() => writePersistedLessonThread(buildLessonThread("quota-storage"))).not.toThrow();
    expect(() =>
      archivePersistedLessonThread(
        buildLessonThread("quota-archive", {
          conversation: [{ id: "1", transcript: "persist this lesson", tutorText: "reply" }],
        })
      )
    ).not.toThrow();
  } finally {
    restoreStorage();
  }
});

test("hydrates to an empty store when browser storage is unavailable", async () => {
  const restoreStorage = denyStorageAccess();

  try {
    await expect(hydrateLessonThreadStore()).resolves.toEqual({ activeThread: null, archive: [], version: 2 });
  } finally {
    restoreStorage();
  }
});

test("resolves when persisting the active thread without browser storage", async () => {
  const restoreStorage = denyStorageAccess();

  try {
    await expect(persistActiveLessonThread(buildLessonThread("blocked-async"))).resolves.toBeUndefined();
  } finally {
    restoreStorage();
  }
});
