"use client";

import { readAvatarProviderPreference } from "./avatar_preference";
import { deriveLearningAnalytics } from "./learning_analytics";
import {
  clearArchivedLessonThreadsRemote,
  clearPersistedLessonThreadRemote,
  readPersistedLessonThreadStore,
} from "./lesson_thread_store";
import { readSessionPreferences } from "./session_preferences";

export function exportLearnerSnapshot() {
  const lessonStore = readPersistedLessonThreadStore();
  const analytics = deriveLearningAnalytics({
    activeThread: lessonStore.activeThread,
    archivedLessons: lessonStore.archive,
  });

  return {
    activeThread: lessonStore.activeThread,
    archive: lessonStore.archive,
    analytics,
    avatarProviderId: readAvatarProviderPreference(),
    exportedAt: new Date().toISOString(),
    preferences: readSessionPreferences(),
  };
}

export async function clearLessonHistory() {
  await clearPersistedLessonThreadRemote();
  await clearArchivedLessonThreadsRemote();
}
