import { buildDashboardViewModel } from "./dashboard_view_model";
import { DEFAULT_SESSION_PREFERENCES } from "./session_preferences";

test("builds the learner-specific dashboard payload", () => {
  const model = buildDashboardViewModel({
    displayName: "Alex Johnson",
    preferences: {
      ...DEFAULT_SESSION_PREFERENCES,
      audioVolume: 0.9,
      subject: "math",
    },
  });

  expect(model.learnerName).toBe("Alex Johnson");
  expect(model.metrics).toHaveLength(4);
  expect(model.quickStart.ctaHref).toBe("/session");
  expect(model.continueLessons[0]?.title).toBe("Addition & Subtraction");
});

test("uses active lesson progress and archived resume items when learning data exists", () => {
  const model = buildDashboardViewModel({
    activeThread: {
      avatarProviderId: "sage-svg-2d",
      conversation: [],
      gradeBand: "3-5",
      lessonState: {
        currentStepIndex: 1,
        currentTask: "Convert each fraction to twelfths",
        lessonId: 3,
        lessonTitle: "Intro to Fractions",
        nextQuestion: "How do we rewrite 1/4 as a fraction with denominator 12?",
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
      sessionId: "active-lesson",
      studentPrompt: "",
      subject: "math",
      transcript: "",
      ttsModel: "gpt-realtime-mini",
      ttsProvider: "openai-realtime",
      tutorText: "",
      version: 1,
    },
    archivedLessons: [
      {
        gradeBand: "6-8",
        id: "archive-1",
        subject: "math",
        thread: {
          avatarProviderId: "sage-svg-2d",
          conversation: [],
          gradeBand: "6-8",
          lessonState: {
            currentStepIndex: 0,
            currentTask: "Solve one-step linear equations",
            lessonId: 6,
            lessonTitle: "Linear Equations",
            nextQuestion: "What do you do first to solve x + 5 = 12?",
            program: [
              "Identify the variable",
              "Undo operations step by step",
              "Check the solution",
            ],
            startedFromCatalog: true,
          },
          llmModel: "gpt-realtime-mini",
          llmProvider: "openai-realtime",
          preference: "",
          sessionId: "archived-lesson",
          studentPrompt: "",
          subject: "math",
          transcript: "",
          ttsModel: "gpt-realtime-mini",
          ttsProvider: "openai-realtime",
          tutorText: "",
          version: 1,
        },
        title: "Linear Equations",
        turnCount: 2,
        updatedAt: "2026-03-11T00:00:00Z",
      },
    ],
    displayName: "Alex Johnson",
    preferences: {
      ...DEFAULT_SESSION_PREFERENCES,
      subject: "math",
    },
  });

  expect(model.quickStart.ctaHref).toBe("/session");
  expect(model.quickStart.title).toBe("Resume Intro to Fractions");
  expect(model.metrics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ label: "Saved Lessons", value: "1" }),
      expect.objectContaining({ label: "Tutor Turns", value: "2" }),
      expect.objectContaining({ label: "Current Step", value: "2/3" }),
      expect.objectContaining({ label: "Focus", value: "Intro to Fractions" }),
    ])
  );
  expect(model.continueLessons[0]).toMatchObject({
    href: "/session",
    task: "Convert each fraction to twelfths",
    title: "Intro to Fractions",
  });
  expect(model.continueLessons[1]).toMatchObject({
    href: "/session?resume=archive-1",
    title: "Linear Equations",
  });
});
