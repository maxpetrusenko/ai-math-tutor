"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

import { resolveAvatarProvider } from "../../components/avatar_registry";
import { DashboardLayout } from "../../components/layout";
import { MetricCard } from "../../components/ui/MetricCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { readAvatarProviderPreference } from "../../lib/avatar_preference";
import { useFirebaseAuth } from "../../lib/firebase_auth";
import { fetchLearningAnalytics } from "../../lib/lesson_thread_api";
import {
  hydrateLessonThreadStore,
  listArchivedLessonThreads,
  readArchivedLessonThread,
  readPersistedLessonThread,
  type PersistedLessonArchiveEntry,
} from "../../lib/lesson_thread_store";
import type { LearningAnalytics } from "../../lib/learning_analytics";
import { buildProfileViewModel } from "../../lib/profile_view_model";
import { readSessionPreferences } from "../../lib/session_preferences";

function readProfileLearningSnapshot() {
  const activeThread = readPersistedLessonThread();
  const archivedLessons = listArchivedLessonThreads()
    .map((summary) => {
      const thread = readArchivedLessonThread(summary.id);
      if (!thread) {
        return null;
      }

      return {
        ...summary,
        thread,
      } satisfies PersistedLessonArchiveEntry;
    })
    .filter((entry): entry is PersistedLessonArchiveEntry => entry !== null);

  return {
    activeThread,
    archivedLessons,
    archivedLessonCount: archivedLessons.length,
  };
}

export default function ProfilePage() {
  const { user } = useFirebaseAuth();
  const preferences = readSessionPreferences();
  const [learningSnapshot, setLearningSnapshot] = useState(() => readProfileLearningSnapshot());
  const [learningAnalytics, setLearningAnalytics] = useState<LearningAnalytics | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      await hydrateLessonThreadStore();
      const analytics = await fetchLearningAnalytics();
      if (!cancelled) {
        setLearningSnapshot(readProfileLearningSnapshot());
        setLearningAnalytics(analytics);
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  const model = buildProfileViewModel({
    activeThread: learningSnapshot.activeThread,
    analytics: learningAnalytics,
    archivedLessons: learningSnapshot.archivedLessons,
    archivedLessonCount: learningSnapshot.archivedLessonCount,
    displayName: user?.displayName,
    email: user?.email,
    preferences,
  });
  const selectedTutor = resolveAvatarProvider(readAvatarProviderPreference() ?? undefined);
  const activeLesson = learningSnapshot.activeThread?.lessonState ?? null;
  const studyStyle = preferences.preference.trim() || "Balanced guidance";

  return (
    <DashboardLayout>
      <div className="page-shell">
        <PageHeader
          subtitle="Manage the learner identity tied to your tutor sessions."
          title="Profile"
        />

        <SurfaceCard className="profile-page__header">
          <div className="profile-page__avatar">{model.initials}</div>
          <div className="profile-page__info">
            <h1>{model.learnerName}</h1>
            <p>{model.email}</p>
            <p className="section-copy section-copy--top-profile">{model.supportNote}</p>
          </div>
        </SurfaceCard>

        <div className="metric-grid">
          {model.highlights.map((highlight) => (
            <MetricCard
              key={highlight.id}
              accent={highlight.accent}
              label={highlight.label}
              value={highlight.value}
            />
          ))}
        </div>

        <div className="field-grid profile-page__detail-grid">
          <SurfaceCard className="surface-card--soft profile-page__focus-card">
            <div className="section-title">Learning profile</div>
            <div className="info-list info-list--top-md">
              <div className="info-list__row">
                <div className="info-list__label">Preferred subject</div>
                <div className="info-list__value">{preferences.subject.charAt(0).toUpperCase() + preferences.subject.slice(1)}</div>
              </div>
              <div className="info-list__row">
                <div className="info-list__label">Grade band</div>
                <div className="info-list__value">{preferences.gradeBand}</div>
              </div>
              <div className="info-list__row">
                <div className="info-list__label">Study style</div>
                <div className="info-list__value">{studyStyle}</div>
              </div>
              <div className="info-list__row">
                <div className="info-list__label">Selected tutor</div>
                <div className="info-list__value">{selectedTutor.label}</div>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="profile-page__focus-card">
            <div className="section-title">Latest checkpoint</div>
            <p className="section-copy section-copy--spaced">
              {activeLesson
                ? "Your tutor is ready to reopen the last guided step."
                : "Start a lesson to save checkpoints and get a resume question here."}
            </p>
            <div className="info-list">
              <div className="info-list__row">
                <div className="info-list__label">Current task</div>
                <div className="info-list__value">{activeLesson?.currentTask ?? "No active lesson yet"}</div>
              </div>
              <div className="info-list__row">
                <div className="info-list__label">Next question</div>
                <div className="info-list__value">{activeLesson?.nextQuestion ?? "Open a lesson to get your first guided question."}</div>
              </div>
            </div>
            <div className="pill-row pill-row--top-md">
              <Link className="primary-button" href={activeLesson ? "/session" : "/lessons"}>
                {activeLesson ? "Continue lesson" : "Browse lessons"}
              </Link>
            </div>
          </SurfaceCard>

          <SurfaceCard className="surface-card--soft profile-page__focus-card">
            <div className="section-title">Achievements earned</div>
            <p className="section-copy section-copy--spaced">
              Derived from your saved lessons, current streak, and recent lesson completion depth.
            </p>
            <div className="info-list">
              <div className="info-list__row">
                <div className="info-list__label">Strongest subject</div>
                <div className="info-list__value">{model.strongestSubject}</div>
              </div>
              <div className="info-list__row">
                <div className="info-list__label">Guided time</div>
                <div className="info-list__value">{model.estimatedMinutesLabel}</div>
              </div>
              <div className="info-list__row">
                <div className="info-list__label">Mastery signal</div>
                <div className="info-list__value">{model.masteryScoreLabel}</div>
              </div>
            </div>
            <div className="pill-row pill-row--top-md">
              {model.achievements.length > 0
                ? model.achievements.map((achievement) => (
                    <span className="tag-badge" key={achievement}>{achievement}</span>
                  ))
                : <span className="tag-badge">First milestone ahead</span>}
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard className="surface-card--soft">
          <div className="row-card row-card--bare profile-page__status-card">
            <div className="row-card__icon">AI</div>
            <div className="row-card__content">
              <div className="row-card__title">{model.statusTitle}</div>
              <div className="row-card__copy">{model.statusCopy}</div>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="section-title section-title--bottom-md">Account summary</div>
          <div className="info-list">
            {model.details.map((row) => (
              <div className="info-list__row" key={row.label}>
                <div className="info-list__label">{row.label}</div>
                <div className="info-list__value">{row.value}</div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="dashboard-section__header">
            <div className="section-title">Saved lesson library</div>
            {learningSnapshot.archivedLessons.length > 0 ? (
              <div className="section-copy">{learningSnapshot.archivedLessonCount} ready to resume</div>
            ) : null}
          </div>
          {learningSnapshot.archivedLessons.length > 0 ? (
            <div className="section-stack">
              {learningSnapshot.archivedLessons.slice(0, 3).map((lesson) => (
                <a className="row-card" href={`/session?resume=${lesson.id}`} key={lesson.id}>
                  <div className="row-card__icon">{lesson.subject.charAt(0).toUpperCase()}</div>
                  <div className="row-card__content">
                    <div className="row-card__title">{lesson.title}</div>
                    <div className="row-card__copy">Resume saved progress from your lesson archive.</div>
                    <div className="row-card__meta">
                      Grade {lesson.gradeBand} · {lesson.turnCount} turn{lesson.turnCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p className="empty-state__text">Saved lessons will appear here after you start and reset a session.</p>
            </div>
          )}
        </SurfaceCard>

        {learningSnapshot.archivedLessons.length > 0 ? (
          <SurfaceCard className="surface-card--soft">
            <div className="section-title">Recent wins</div>
            <div className="pill-row pill-row--top-md">
              {learningSnapshot.archivedLessons.slice(0, 3).map((lesson) => (
                <span className="tag-badge" key={lesson.id}>{lesson.title}</span>
              ))}
            </div>
          </SurfaceCard>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
