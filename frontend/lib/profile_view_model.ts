import type { PersistedLessonThread } from "./lesson_thread_store";
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
  details: ProfileSummaryRow[];
  email: string;
  highlights: ProfileHighlight[];
  initials: string;
  learnerName: string;
  statusCopy: string;
  statusTitle: string;
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
  archivedLessonCount?: number;
  displayName?: string | null;
  email?: string | null;
  preferences: SessionPreferences;
}) : ProfileViewModel {
  const learnerName = input.displayName?.trim() || "Student";
  const email = input.email?.trim() || "Guest mode";
  const activeThread = input.activeThread ?? null;
  const archivedLessonCount = input.archivedLessonCount ?? 0;
  const activeLessonTitle = activeThread?.lessonState?.lessonTitle ?? "Ready for the next lesson";
  const currentStep = activeThread?.lessonState
    ? `${activeThread.lessonState.currentStepIndex + 1}/${activeThread.lessonState.program.length}`
    : "Ready";
  const studyStyle = input.preferences.preference.trim() || "Balanced guidance";
  const subjectLabel = formatSubjectLabel(input.preferences.subject);
  const syncLabel = input.email?.trim()
    ? "Signed in. This device keeps your preferences and saved lessons ready to resume."
    : "Guest mode. Preferences stay local until you sign in.";

  return {
    details: [
      { label: "Name", value: learnerName },
      { label: "Email", value: email },
      { label: "Preferred subject", value: subjectLabel },
      { label: "Grade band", value: input.preferences.gradeBand },
      { label: "Interface language", value: formatLanguageLabel(input.preferences.interfaceLanguage) },
      { label: "Study style", value: studyStyle },
      { label: "Active lesson", value: activeLessonTitle },
    ],
    email,
    highlights: [
      { accent: "primary", id: "saved-lessons", label: "Saved lessons", value: `${archivedLessonCount}` },
      { accent: "secondary", id: "current-step", label: "Current step", value: currentStep },
      { accent: "success", id: "focus", label: "Focus", value: activeThread?.lessonState?.lessonTitle ?? subjectLabel },
    ],
    initials: getInitials(input.displayName, input.email),
    learnerName,
    statusCopy: activeThread?.lessonState?.nextQuestion ?? `Your tutor is set for ${subjectLabel.toLowerCase()} help.`,
    statusTitle: activeThread?.lessonState ? `Resume ${activeThread.lessonState.lessonTitle}` : "Learner snapshot",
    supportNote: syncLabel,
  };
}
