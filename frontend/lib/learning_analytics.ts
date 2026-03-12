import type { LessonState } from "./lesson_catalog";
import type { PersistedLessonThread } from "./lesson_thread_store";

export type LearningAnalyticsLesson = {
  lessonState?: LessonState | null;
  subject?: string;
  thread?: PersistedLessonThread;
  title: string;
  turnCount: number;
  updatedAt: string;
};

export type LearningAnalyticsAchievement = {
  detail: string;
  id: string;
  label: string;
};

export type LearningAnalytics = {
  achievements: LearningAnalyticsAchievement[];
  completedLessons: number;
  currentStreakDays: number;
  estimatedMinutes: number;
  masteryScore: number;
  practiceDays: number;
  recentLessonTitles: string[];
  strongestSubject: string;
  tutorTurns: number;
};

function toDayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function dayKeyToUtcMs(dayKey: string) {
  return new Date(`${dayKey}T00:00:00.000Z`).getTime();
}

function formatSubjectLabel(subject: string) {
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

function resolveLessonState(lesson: LearningAnalyticsLesson) {
  return lesson.lessonState ?? lesson.thread?.lessonState ?? null;
}

function resolveLessonSubject(lesson: LearningAnalyticsLesson) {
  return lesson.subject ?? lesson.thread?.subject ?? null;
}

function buildPracticeDayKeys(
  activeThread: PersistedLessonThread | null,
  archivedLessons: LearningAnalyticsLesson[],
  now: Date
) {
  const dayKeys = new Set<string>();

  if (activeThread) {
    dayKeys.add(now.toISOString().slice(0, 10));
  }

  for (const lesson of archivedLessons) {
    const dayKey = toDayKey(lesson.updatedAt);
    if (dayKey) {
      dayKeys.add(dayKey);
    }
  }

  return Array.from(dayKeys).sort((left, right) => dayKeyToUtcMs(right) - dayKeyToUtcMs(left));
}

function computeCurrentStreak(dayKeys: string[], now: Date) {
  if (dayKeys.length === 0) {
    return 0;
  }

  const todayKey = now.toISOString().slice(0, 10);
  const yesterdayKey = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  const startsTodayOrYesterday = dayKeys[0] === todayKey || dayKeys[0] === yesterdayKey;
  if (!startsTodayOrYesterday) {
    return 0;
  }

  let streak = 1;
  for (let index = 1; index < dayKeys.length; index += 1) {
    const currentMs = dayKeyToUtcMs(dayKeys[index - 1]);
    const nextMs = dayKeyToUtcMs(dayKeys[index]);
    const diffDays = Math.round((currentMs - nextMs) / (24 * 60 * 60 * 1000));
    if (diffDays !== 1) {
      break;
    }
    streak += 1;
  }

  return streak;
}

function estimateArchivedLessonMastery(lesson: LearningAnalyticsLesson) {
  const lessonState = resolveLessonState(lesson);
  if (lessonState?.program.length) {
    return Math.round(((lessonState.currentStepIndex + 1) / lessonState.program.length) * 100);
  }

  return Math.min(90, 45 + (lesson.turnCount * 15));
}

function estimateActiveLessonMastery(activeThread: PersistedLessonThread | null) {
  if (!activeThread?.lessonState?.program.length) {
    return null;
  }

  const completionRatio =
    (activeThread.lessonState.currentStepIndex + 1) / activeThread.lessonState.program.length;
  return Math.round(completionRatio * 100);
}

function resolveStrongestSubject(
  activeThread: PersistedLessonThread | null,
  archivedLessons: LearningAnalyticsLesson[]
) {
  const subjectCounts = new Map<string, number>();
  const increment = (subject: string | null | undefined) => {
    if (!subject?.trim()) {
      return;
    }
    subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + 1);
  };

  increment(activeThread?.subject);
  archivedLessons.forEach((lesson) => increment(resolveLessonSubject(lesson)));

  const rankedSubjects = Array.from(subjectCounts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });

  return rankedSubjects[0]?.[0] ? formatSubjectLabel(rankedSubjects[0][0]) : "Math";
}

function buildAchievements(input: {
  completedLessons: number;
  currentStreakDays: number;
  estimatedMinutes: number;
  masteryScore: number;
}) {
  const achievements: LearningAnalyticsAchievement[] = [];

  if (input.currentStreakDays >= 2) {
    achievements.push({
      detail: `Practiced ${input.currentStreakDays} days in a row`,
      id: "streak",
      label: `${input.currentStreakDays}-day streak`,
    });
  }

  if (input.completedLessons >= 2) {
    achievements.push({
      detail: `Wrapped ${input.completedLessons} saved lessons`,
      id: "lesson-finisher",
      label: "Lesson finisher",
    });
  }

  if (input.masteryScore >= 70) {
    achievements.push({
      detail: "Built strong completion across recent lesson steps",
      id: "mastery",
      label: "Mastery climbing",
    });
  }

  if (input.estimatedMinutes >= 15) {
    achievements.push({
      detail: `${input.estimatedMinutes} guided minutes banked this cycle`,
      id: "deep-practice",
      label: "Deep practice",
    });
  }

  return achievements;
}

export function deriveLearningAnalytics(input: {
  activeThread?: PersistedLessonThread | null;
  archivedLessons?: LearningAnalyticsLesson[];
  now?: Date;
}): LearningAnalytics {
  const activeThread = input.activeThread ?? null;
  const archivedLessons = input.archivedLessons ?? [];
  const now = input.now ?? new Date();
  const practiceDayKeys = buildPracticeDayKeys(activeThread, archivedLessons, now);
  const archivedTurns = archivedLessons.reduce((total, lesson) => total + lesson.turnCount, 0);
  const activeTurns = activeThread?.conversation.length ?? 0;
  const estimatedMinutes = (archivedTurns * 3) + (activeTurns * 3);
  const masteryInputs = archivedLessons.map(estimateArchivedLessonMastery);
  const activeMastery = estimateActiveLessonMastery(activeThread);
  if (activeMastery !== null) {
    masteryInputs.push(activeMastery);
  }
  const masteryScore = masteryInputs.length > 0
    ? Math.round(masteryInputs.reduce((total, value) => total + value, 0) / masteryInputs.length)
    : 0;
  const strongestSubject = resolveStrongestSubject(activeThread, archivedLessons);
  const completedLessons = archivedLessons.length;
  const currentStreakDays = computeCurrentStreak(practiceDayKeys, now);

  return {
    achievements: buildAchievements({
      completedLessons,
      currentStreakDays,
      estimatedMinutes,
      masteryScore,
    }),
    completedLessons,
    currentStreakDays,
    estimatedMinutes,
    masteryScore,
    practiceDays: practiceDayKeys.length,
    recentLessonTitles: archivedLessons
      .slice()
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, 3)
      .map((lesson) => lesson.title),
    strongestSubject,
    tutorTurns: archivedTurns + activeTurns,
  };
}
