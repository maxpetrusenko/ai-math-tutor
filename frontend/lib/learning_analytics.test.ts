import { deriveLearningAnalytics } from "./learning_analytics";

test("derives practice days, streak, and recent wins from archived lesson history", () => {
  const analytics = deriveLearningAnalytics({
    activeThread: {
      avatarProviderId: "sage-svg-2d",
      conversation: [{ id: "1", transcript: "hi", tutorText: "hello" }],
      gradeBand: "3-5",
      llmModel: "gemini-3-flash-preview",
      llmProvider: "gemini",
      preference: "",
      sessionId: "active",
      studentPrompt: "",
      subject: "math",
      transcript: "",
      ttsModel: "sonic-2",
      ttsProvider: "cartesia",
      tutorText: "",
      version: 1,
    },
    archivedLessons: [
      { title: "Linear Equations", turnCount: 2, updatedAt: "2026-03-11T09:00:00Z" },
      { title: "Geometry Basics", turnCount: 1, updatedAt: "2026-03-10T09:00:00Z" },
    ],
    now: new Date("2026-03-12T12:00:00Z"),
  });

  expect(analytics).toEqual({
    achievements: [
      { detail: "Practiced 3 days in a row", id: "streak", label: "3-day streak" },
      { detail: "Wrapped 2 saved lessons", id: "lesson-finisher", label: "Lesson finisher" },
    ],
    completedLessons: 2,
    currentStreakDays: 3,
    estimatedMinutes: 12,
    masteryScore: 68,
    practiceDays: 3,
    recentLessonTitles: ["Linear Equations", "Geometry Basics"],
    strongestSubject: "Math",
    tutorTurns: 4,
  });
});
