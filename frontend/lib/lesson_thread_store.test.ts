import {
  archivePersistedLessonThread,
  clearPersistedLessonThread,
  listArchivedLessonThreads,
  readPersistedLessonThread,
  writePersistedLessonThread,
} from "./lesson_thread_store";

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
