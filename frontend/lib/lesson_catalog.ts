export type LessonCatalogItem = {
  description: string;
  duration: string;
  grade: string;
  id: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  subject: string;
  symbol: string;
  title: string;
};

export type LessonState = {
  currentStepIndex: number;
  currentTask: string;
  lastTutorAction?: string;
  lessonId: number;
  lessonTitle: string;
  nextQuestion: string;
  program: string[];
  startedFromCatalog: boolean;
};

export const LESSON_CATALOG: LessonCatalogItem[] = [
  {
    description: "Build fluency with totals, number bonds, and quick mental math.",
    duration: "15 min",
    grade: "K-2",
    id: 1,
    level: "Beginner",
    subject: "Arithmetic",
    symbol: "+",
    title: "Addition & Subtraction",
  },
  {
    description: "Practice patterns and multiplication facts with step-by-step help.",
    duration: "20 min",
    grade: "3-5",
    id: 2,
    level: "Beginner",
    subject: "Arithmetic",
    symbol: "×",
    title: "Multiplication Tables",
  },
  {
    description: "Understand parts of a whole using visual models and word problems.",
    duration: "25 min",
    grade: "3-5",
    id: 3,
    level: "Intermediate",
    subject: "Fractions",
    symbol: "◔",
    title: "Intro to Fractions",
  },
  {
    description: "Explore shapes, angles, and perimeter with guided examples.",
    duration: "20 min",
    grade: "3-5",
    id: 4,
    level: "Beginner",
    subject: "Geometry",
    symbol: "△",
    title: "Geometry Basics",
  },
  {
    description: "Bridge arithmetic into variables, equations, and patterns.",
    duration: "30 min",
    grade: "6-8",
    id: 5,
    level: "Intermediate",
    subject: "Algebra",
    symbol: "1234",
    title: "Pre-Algebra",
  },
  {
    description: "Solve and graph one-step and multi-step equations clearly.",
    duration: "30 min",
    grade: "6-8",
    id: 6,
    level: "Intermediate",
    subject: "Algebra",
    symbol: "↗",
    title: "Linear Equations",
  },
  {
    description: "Interpret quadratic forms, graphs, and transformations.",
    duration: "35 min",
    grade: "9-12",
    id: 7,
    level: "Advanced",
    subject: "Algebra",
    symbol: "▮▮",
    title: "Quadratic Functions",
  },
  {
    description: "Work through angles, ratios, and identities with tutoring support.",
    duration: "40 min",
    grade: "9-12",
    id: 8,
    level: "Advanced",
    subject: "Geometry",
    symbol: "/",
    title: "Trigonometry",
  },
];

const LESSON_PROGRAMS: Record<number, Omit<LessonState, "lessonId" | "lessonTitle">> = {
  1: {
    currentStepIndex: 0,
    currentTask: "Warm up with addition and subtraction patterns",
    nextQuestion: "What is 9 + 6, and how did you figure it out?",
    program: [
      "Warm up with number bonds",
      "Add and subtract with quick strategies",
      "Check the answer with a word problem",
    ],
    startedFromCatalog: true,
  },
  2: {
    currentStepIndex: 0,
    currentTask: "Recall multiplication facts in patterns",
    nextQuestion: "What pattern do you notice in the 3 times table?",
    program: [
      "Notice multiplication patterns",
      "Use facts to solve quick products",
      "Check understanding with one challenge problem",
    ],
    startedFromCatalog: true,
  },
  3: {
    currentStepIndex: 0,
    currentTask: "Add fractions with unlike denominators",
    nextQuestion: "What common denominator can we use for 1/4 and 2/3?",
    program: [
      "Understand what the fractions represent",
      "Add fractions with unlike denominators",
      "Check the answer with one more example",
    ],
    startedFromCatalog: true,
  },
  4: {
    currentStepIndex: 0,
    currentTask: "Identify shapes and their key properties",
    nextQuestion: "How is a triangle different from a rectangle?",
    program: [
      "Name core shapes",
      "Compare angles and sides",
      "Apply the ideas to a quick puzzle",
    ],
    startedFromCatalog: true,
  },
  5: {
    currentStepIndex: 0,
    currentTask: "Translate arithmetic patterns into variable expressions",
    nextQuestion: "If x is 4, what is x + 3?",
    program: [
      "Review number patterns",
      "Introduce variables and expressions",
      "Solve a short guided check",
    ],
    startedFromCatalog: true,
  },
  6: {
    currentStepIndex: 0,
    currentTask: "Solve one-step linear equations",
    nextQuestion: "What do you do first to solve x + 5 = 12?",
    program: [
      "Identify the variable",
      "Undo operations step by step",
      "Check the solution",
    ],
    startedFromCatalog: true,
  },
  7: {
    currentStepIndex: 0,
    currentTask: "Connect quadratic equations to their graphs",
    nextQuestion: "What shape do you expect from y = x^2?",
    program: [
      "Recognize quadratic form",
      "Relate equation and graph",
      "Test understanding with one graph check",
    ],
    startedFromCatalog: true,
  },
  8: {
    currentStepIndex: 0,
    currentTask: "Use angle relationships and trig ratios",
    nextQuestion: "Which trig ratio would you use for opposite over hypotenuse?",
    program: [
      "Review triangle vocabulary",
      "Pick the right trig ratio",
      "Apply it to one example",
    ],
    startedFromCatalog: true,
  },
};

export function resolveLessonCatalogItem(lessonId: number | string) {
  const normalizedId = typeof lessonId === "string" ? Number.parseInt(lessonId, 10) : lessonId;
  if (!Number.isFinite(normalizedId)) {
    return null;
  }

  return LESSON_CATALOG.find((lesson) => lesson.id === normalizedId) ?? null;
}

export function buildLessonStateFromCatalog(lessonId: number | string): LessonState | null {
  const lesson = resolveLessonCatalogItem(lessonId);
  if (!lesson) {
    return null;
  }

  const template = LESSON_PROGRAMS[lesson.id];
  if (!template) {
    return null;
  }

  return {
    ...template,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
  };
}

export function resolveLessonResumeQuestion(lessonState: LessonState | null | undefined) {
  if (!lessonState) {
    return "";
  }

  const directQuestion = lessonState.nextQuestion.trim();
  if (directQuestion) {
    return directQuestion;
  }

  return `Let's continue with ${lessonState.currentTask.toLowerCase()}. What should we do first?`;
}

export function filterLessonCatalog(input: {
  activeGrade: string;
  query: string;
}) {
  const normalizedQuery = input.query.trim().toLowerCase();

  return LESSON_CATALOG.filter((lesson) => {
    const gradeMatch = input.activeGrade === "All" || lesson.grade === input.activeGrade;
    const queryMatch =
      normalizedQuery.length === 0
      || lesson.title.toLowerCase().includes(normalizedQuery)
      || lesson.subject.toLowerCase().includes(normalizedQuery)
      || lesson.description.toLowerCase().includes(normalizedQuery);

    return gradeMatch && queryMatch;
  });
}
