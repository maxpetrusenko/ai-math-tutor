import type { PersistedLessonThread } from "./lesson_thread_store";
import {
  deriveLearningAnalytics,
  type LearningAnalytics,
  type LearningAnalyticsLesson,
} from "./learning_analytics";
import type { SessionPreferences } from "./session_preferences";

export type ProfileSummaryRow = {
  label: string;
  value: string;
};

export type ProfileHighlight = {
  accent: "primary" | "secondary" | "success" | "neutral";
  id: string;
  label: string;
  value: string;
};

export type ProfileViewModel = {
  achievements: string[];
  details: ProfileSummaryRow[];
  email: string;
  estimatedMinutesLabel: string;
  highlights: ProfileHighlight[];
  initials: string;
  learnerName: string;
  masteryScoreLabel: string;
  statusCopy: string;
  statusTitle: string;
  strongestSubject: string;
  supportNote: string;
};

function getInitials(name?: string | null, email?: string | null) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((token) => token[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  if (email?.trim()) {
    return email[0]?.toUpperCase() ?? "?";
  }

  return "?";
}

function formatSubjectLabel(subject: string) {
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

function formatLanguageLabel(language: string) {
  if (language === "es") {
    return "Espanol";
  }

  if (language === "fr") {
    return "Francais";
  }

  return "English";
}

export function buildProfileViewModel(input: {
  activeThread?: PersistedLessonThread | null;
  analytics?: LearningAnalytics | null;
  archivedLessons?: LearningAnalyticsLesson[];
  archivedLessonCount?: number;
  displayName?: string | null;
  email?: string | null;
  preferences: SessionPreferences;
}) : ProfileViewModel {
  const learnerName = input.displayName?.trim() || "Student";
  const email = input.email?.trim() || "Guest mode";
  const activeThread = input.activeThread ?? null;
  const archivedLessonCount = input.archivedLessonCount ?? 0;
  const analytics = input.analytics ?? deriveLearningAnalytics({
    activeThread,
    archivedLessons: input.archivedLessons ?? [],
  });
  const activeLessonTitle = activeThread?.lessonState?.lessonTitle ?? "Ready for the next lesson";
  const studyStyle = input.preferences.preference.trim() || "Balanced guidance";
  const subjectLabel = formatSubjectLabel(input.preferences.subject);
  const syncLabel = input.email?.trim()
    ? "Signed in. This device keeps your preferences and saved lessons ready to resume."
    : "Guest mode. Preferences stay local until you sign in.";

  return {
    achievements: analytics.achievements.map((achievement) => achievement.label),
    details: [
      { label: "Name", value: learnerName },
      { label: "Email", value: email },
      { label: "Preferred subject", value: subjectLabel },
      { label: "Grade band", value: input.preferences.gradeBand },
      { label: "Interface language", value: formatLanguageLabel(input.preferences.interfaceLanguage) },
      { label: "Study style", value: studyStyle },
      { label: "Active lesson", value: activeLessonTitle },
      { label: "Practice days", value: `${analytics.practiceDays}` },
      { label: "Current streak", value: analytics.currentStreakDays > 0 ? `${analytics.currentStreakDays} days` : "Start today" },
    ],
    email,
    estimatedMinutesLabel: analytics.estimatedMinutes > 0 ? `${analytics.estimatedMinutes} min` : "Just starting",
    highlights: [
      { accent: "primary", id: "saved-lessons", label: "Saved lessons", value: `${archivedLessonCount}` },
      { accent: "secondary", id: "practice-days", label: "Practice days", value: `${analytics.practiceDays}` },
      { accent: "success", id: "current-streak", label: "Current streak", value: analytics.currentStreakDays > 0 ? `${analytics.currentStreakDays} days` : "Start today" },
    ],
    initials: getInitials(input.displayName, input.email),
    learnerName,
    masteryScoreLabel: analytics.masteryScore > 0 ? `${analytics.masteryScore}%` : "Building",
    statusCopy: activeThread?.lessonState?.nextQuestion ?? `Your tutor is set for ${subjectLabel.toLowerCase()} help.`,
    statusTitle: activeThread?.lessonState ? `Resume ${activeThread.lessonState.lessonTitle}` : "Learner snapshot",
    strongestSubject: analytics.strongestSubject,
    supportNote: syncLabel,
  };
}
