import { buildProfileViewModel } from "./profile_view_model";
import { DEFAULT_SESSION_PREFERENCES } from "./session_preferences";

test("builds an honest learner profile model from preferences and lesson progress", () => {
  const model = buildProfileViewModel({
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
      llmModel: "gemini-3-flash-preview",
      llmProvider: "gemini",
      preference: "More worked examples",
      sessionId: "active-profile-lesson",
      studentPrompt: "",
      subject: "math",
      transcript: "",
      ttsModel: "sonic-2",
      ttsProvider: "cartesia",
      tutorText: "",
      version: 1,
    },
    archivedLessonCount: 2,
    displayName: "Alex Johnson",
    email: "alex@example.com",
    preferences: {
      ...DEFAULT_SESSION_PREFERENCES,
      gradeBand: "3-5",
      interfaceLanguage: "en",
      preference: "More worked examples",
      subject: "math",
    },
  });

  expect(model.initials).toBe("AJ");
  expect(model.details[0]).toEqual({ label: "Name", value: "Alex Johnson" });
  expect(model.details).toEqual(
    expect.arrayContaining([
      { label: "Preferred subject", value: "Math" },
      { label: "Grade band", value: "3-5" },
      { label: "Active lesson", value: "Intro to Fractions" },
    ])
  );
  expect(model.highlights).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ label: "Saved lessons", value: "2" }),
      expect.objectContaining({ label: "Current step", value: "2/3" }),
    ])
  );
  expect(model.supportNote).toContain("saved lessons");
});
