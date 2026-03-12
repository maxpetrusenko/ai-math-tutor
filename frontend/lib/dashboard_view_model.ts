import type { PersistedLessonArchiveEntry, PersistedLessonThread } from "./lesson_thread_store";
import { resolveLessonCatalogItem, resolveLessonResumeQuestion } from "./lesson_catalog";
import { deriveLearningAnalytics, type LearningAnalytics } from "./learning_analytics";
import type { SessionPreferences } from "./session_preferences";

export type DashboardMetric = {
  accent: "primary" | "secondary" | "success" | "neutral";
  id: string;
  label: string;
  value: string;
};

export type DashboardLesson = {
  actionLabel: string;
  href: string;
  icon: string;
  id: string;
  meta: string;
  task: string;
  title: string;
};

export type DashboardViewModel = {
  achievements: string[];
  continueLessons: DashboardLesson[];
  estimatedMinutesLabel: string;
  learnerName: string;
  masteryScoreLabel: string;
  metrics: DashboardMetric[];
  recentWins: string[];
  quickStart: {
    ctaHref: string;
    ctaLabel: string;
    description: string;
    title: string;
  };
  strongestSubject: string;
  subtitle: string;
};

const FALLBACK_LESSONS: DashboardLesson[] = [
  {
    actionLabel: "Open Addition & Subtraction",
    href: "/session?lesson=1",
    icon: "+",
    id: "lesson-1",
    meta: "K-2 · Arithmetic · 15 min",
    task: "Warm up with addition and subtraction patterns",
    title: "Addition & Subtraction",
  },
  {
    actionLabel: "Open Multiplication Tables",
    href: "/session?lesson=2",
    icon: "×",
    id: "lesson-2",
    meta: "3-5 · Arithmetic · 20 min",
    task: "Recall multiplication facts in patterns",
    title: "Multiplication Tables",
  },
  {
    actionLabel: "Open Intro to Fractions",
    href: "/session?lesson=3",
    icon: "◔",
    id: "lesson-3",
    meta: "3-5 · Fractions · 25 min",
    task: "Add fractions with unlike denominators",
    title: "Intro to Fractions",
  },
];

function formatSubjectLabel(subject: string) {
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

function resolveThreadTitle(thread: PersistedLessonThread) {
  return thread.lessonState?.lessonTitle
    || thread.studentPrompt.trim()
    || thread.transcript.trim()
    || "Untitled lesson";
}

function resolveThreadTask(thread: PersistedLessonThread) {
  return thread.lessonState?.currentTask
    || thread.tutorText.trim()
    || thread.studentPrompt.trim()
    || "Continue this lesson";
}

function resolveThreadMeta(thread: PersistedLessonThread) {
  if (thread.lessonState) {
    return `Step ${thread.lessonState.currentStepIndex + 1}/${thread.lessonState.program.length} · Grade ${thread.gradeBand}`;
  }

  return `Grade ${thread.gradeBand} · ${formatSubjectLabel(thread.subject)}`;
}

function resolveThreadIcon(thread: PersistedLessonThread) {
  if (thread.lessonState?.lessonId) {
    return resolveLessonCatalogItem(thread.lessonState.lessonId)?.symbol ?? thread.subject.charAt(0).toUpperCase();
  }

  return thread.subject.charAt(0).toUpperCase();
}

function buildActiveLesson(thread: PersistedLessonThread): DashboardLesson {
  return {
    actionLabel: "Resume now",
    href: "/session",
    icon: resolveThreadIcon(thread),
    id: thread.sessionId,
    meta: resolveThreadMeta(thread),
    task: resolveThreadTask(thread),
    title: resolveThreadTitle(thread),
  };
}

function buildArchivedLesson(entry: PersistedLessonArchiveEntry): DashboardLesson {
  return {
    actionLabel: `Resume ${resolveThreadTitle(entry.thread)}`,
    href: `/session?resume=${entry.id}`,
    icon: resolveThreadIcon(entry.thread),
    id: entry.id,
    meta: resolveThreadMeta(entry.thread),
    task: resolveThreadTask(entry.thread),
    title: resolveThreadTitle(entry.thread),
  };
}

export function buildDashboardViewModel(input: {
  activeThread?: PersistedLessonThread | null;
  analytics?: LearningAnalytics | null;
  archivedLessons?: PersistedLessonArchiveEntry[];
  displayName?: string | null;
  email?: string | null;
  preferences: SessionPreferences;
}): DashboardViewModel {
  const learnerName =
    input.displayName?.trim()
    || input.email?.split("@")[0]
    || "Alex";
  const subjectLabel = formatSubjectLabel(input.preferences.subject);
  const activeThread = input.activeThread ?? null;
  const archivedLessons = input.archivedLessons ?? [];
  const continueLessons = [
    ...(activeThread ? [buildActiveLesson(activeThread)] : []),
    ...archivedLessons.slice(0, activeThread ? 2 : 3).map(buildArchivedLesson),
  ];
  const continueLearning = continueLessons.length > 0 ? continueLessons : FALLBACK_LESSONS;
  const analytics = input.analytics ?? deriveLearningAnalytics({
    activeThread,
    archivedLessons,
  });
  const focusValue = activeThread?.lessonState?.lessonTitle ?? subjectLabel;

  return {
    achievements: analytics.achievements.map((achievement) => achievement.label),
    continueLessons: continueLearning,
    estimatedMinutesLabel: analytics.estimatedMinutes > 0 ? `${analytics.estimatedMinutes} min` : "Just starting",
    learnerName,
    masteryScoreLabel: analytics.masteryScore > 0 ? `${analytics.masteryScore}%` : "Building",
    metrics: [
      { accent: "primary", id: "lessons", label: "Completed Lessons", value: `${analytics.completedLessons}` },
      { accent: "secondary", id: "practice-days", label: "Practice Days", value: `${analytics.practiceDays}` },
      { accent: "primary", id: "streak", label: "Current Streak", value: analytics.currentStreakDays > 0 ? `${analytics.currentStreakDays} days` : "Start today" },
      { accent: "success", id: "focus", label: "Focus", value: focusValue },
    ],
    recentWins: analytics.recentLessonTitles,
    quickStart: activeThread
      ? {
          ctaHref: "/session",
          ctaLabel: "Continue lesson",
          description: resolveLessonResumeQuestion(activeThread.lessonState) || `Continue with ${resolveThreadTask(activeThread).toLowerCase()}.`,
          title: `Resume ${resolveThreadTitle(activeThread)}`,
        }
      : {
          ctaHref: "/session",
          ctaLabel: "Start Session",
          description: `Jump back into ${subjectLabel.toLowerCase()} with your current tutor setup.`,
          title: "Start a tutor session",
        },
    strongestSubject: analytics.strongestSubject,
    subtitle: activeThread?.lessonState
      ? `Pick up ${activeThread.lessonState.lessonTitle.toLowerCase()} where you stopped.`
      : `Ready to tackle some ${subjectLabel.toLowerCase()} today?`,
  };
}
