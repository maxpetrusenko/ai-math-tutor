import { buildLessonStateFromCatalog, filterLessonCatalog } from "./lesson_catalog";

test("filters lesson catalog by grade and query", () => {
  expect(filterLessonCatalog({ activeGrade: "6-8", query: "algebra" }).map((lesson) => lesson.title)).toEqual(
    expect.arrayContaining(["Pre-Algebra", "Linear Equations"])
  );
  expect(filterLessonCatalog({ activeGrade: "K-2", query: "fractions" })).toHaveLength(0);
});

test("builds a simple guided lesson state for catalog lessons", () => {
  expect(buildLessonStateFromCatalog(3)).toMatchObject({
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
  });
});
