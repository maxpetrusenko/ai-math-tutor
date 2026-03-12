"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

import { DashboardLayout } from "../../components/layout";
import { MetricCard } from "../../components/ui/MetricCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import {
  hydrateLessonThreadStore,
  listArchivedLessonThreads,
  readArchivedLessonThread,
  readPersistedLessonThread,
  type PersistedLessonArchiveEntry,
} from "../../lib/lesson_thread_store";
import { useFirebaseAuth } from "../../lib/firebase_auth";
import { fetchLearningAnalytics } from "../../lib/lesson_thread_api";
import type { LearningAnalytics } from "../../lib/learning_analytics";
import { readSessionPreferences } from "../../lib/session_preferences";
import { buildDashboardViewModel } from "../../lib/dashboard_view_model";

function readDashboardLearningSnapshot() {
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
  };
}

export default function DashboardPage() {
  const { user } = useFirebaseAuth();
  const [learningSnapshot, setLearningSnapshot] = useState(() => readDashboardLearningSnapshot());
  const [learningAnalytics, setLearningAnalytics] = useState<LearningAnalytics | null>(null);
  const preferences = readSessionPreferences();

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      await hydrateLessonThreadStore();
      const analytics = await fetchLearningAnalytics();
      if (!cancelled) {
        setLearningSnapshot(readDashboardLearningSnapshot());
        setLearningAnalytics(analytics);
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  const viewModel = buildDashboardViewModel({
    activeThread: learningSnapshot.activeThread,
    analytics: learningAnalytics,
    archivedLessons: learningSnapshot.archivedLessons,
    displayName: user?.displayName,
    email: user?.email,
    preferences,
  });
  const activeLesson = learningSnapshot.activeThread?.lessonState ?? null;
  const studyStyle = preferences.preference.trim() || "Balanced guidance";

  return (
    <DashboardLayout>
      <div className="page-shell dashboard-page">
        <SurfaceCard className="dashboard-hero">
          <PageHeader
            badge="Today"
            subtitle={viewModel.subtitle}
            title={`Hey ${viewModel.learnerName}!`}
          />
        </SurfaceCard>

        <div className="metric-grid">
          {viewModel.metrics.map((metric) => (
            <MetricCard
              key={metric.id}
              accent={metric.accent}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </div>

        <div className="field-grid dashboard-focus-grid">
          <SurfaceCard className="surface-card--soft dashboard-focus-card">
            <div className="section-title">Where you stopped</div>
            <div className="section-copy section-copy--top-sm">
              {activeLesson
                ? "Resume from the exact checkpoint in your active lesson."
                : "No active lesson yet. Start one and Nerdy will keep your place."}
            </div>
            <div className="info-list info-list--top-sm">
              <div className="info-list__row">
                <div className="info-list__label">Current task</div>
                <div className="info-list__value">{activeLesson?.currentTask ?? "Ready for the next lesson"}</div>
              </div>
              <div className="info-list__row">
                <div className="info-list__label">Next question</div>
                <div className="info-list__value">{activeLesson?.nextQuestion ?? "Pick a lesson to get the first guided question."}</div>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="surface-card--soft dashboard-focus-card">
            <div className="section-title">Learning setup</div>
            <div className="section-copy section-copy--top-sm">
              The tutor uses your saved defaults every time a lesson starts.
            </div>
            <div className="info-list info-list--top-sm">
              <div className="info-list__row">
                <div className="info-list__label">Subject</div>
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
            </div>
          </SurfaceCard>

          <SurfaceCard className="surface-card--soft dashboard-focus-card">
            <div className="section-title">Learning momentum</div>
            <div className="section-copy section-copy--top-sm">
              Quick read on where your recent lesson history is building confidence.
            </div>
            <div className="info-list info-list--top-sm">
              <div className="info-list__row">
                <div className="info-list__label">Strongest subject</div>
                <div className="info-list__value">{viewModel.strongestSubject}</div>
              </div>
              <div className="info-list__row">
                <div className="info-list__label">Guided time</div>
                <div className="info-list__value">{viewModel.estimatedMinutesLabel}</div>
              </div>
              <div className="info-list__row">
                <div className="info-list__label">Mastery signal</div>
                <div className="info-list__value">{viewModel.masteryScoreLabel}</div>
              </div>
            </div>
            <div className="pill-row pill-row--top-md">
              {viewModel.achievements.length > 0
                ? viewModel.achievements.map((achievement) => (
                    <span className="tag-badge" key={achievement}>{achievement}</span>
                  ))
                : <span className="tag-badge">First milestone ahead</span>}
            </div>
          </SurfaceCard>
        </div>

        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2 className="dashboard-section__title">Continue Learning</h2>
            <Link className="dashboard-section__link" href="/lessons">
              See all
            </Link>
          </div>
          <div className="section-stack">
            {viewModel.continueLessons.map((lesson) => (
              <Link
                aria-label={lesson.actionLabel}
                className="row-card dashboard-continue-card"
                href={lesson.href}
                key={lesson.id}
              >
                <div className="row-card__icon">{lesson.icon}</div>
                <div className="row-card__content">
                  <div className="row-card__title">{lesson.title}</div>
                  <div className="row-card__copy">{lesson.task}</div>
                  <div className="row-card__meta">{lesson.meta}</div>
                </div>
                <span className="dashboard-continue-card__cta">{lesson.actionLabel}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2 className="dashboard-section__title">Saved lesson library</h2>
            {learningSnapshot.archivedLessons.length > 0 ? (
              <div className="section-copy">{learningSnapshot.archivedLessons.length} lessons saved</div>
            ) : null}
          </div>
          {learningSnapshot.archivedLessons.length > 0 ? (
            <div className="section-stack">
              {learningSnapshot.archivedLessons.slice(0, 3).map((lesson) => (
                <Link
                  className="row-card dashboard-continue-card"
                  href={`/session?resume=${lesson.id}`}
                  key={lesson.id}
                >
                  <div className="row-card__icon">{lesson.subject.charAt(0).toUpperCase()}</div>
                  <div className="row-card__content">
                    <div className="row-card__title">{lesson.title}</div>
                    <div className="row-card__copy">Reopen the saved thread and continue where you paused.</div>
                    <div className="row-card__meta">
                      Grade {lesson.gradeBand} · {lesson.turnCount} turn{lesson.turnCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <SurfaceCard className="surface-card--soft">
              <div className="section-copy">Saved lessons appear here after you wrap a session and come back later.</div>
            </SurfaceCard>
          )}
        </section>

        {viewModel.recentWins.length > 0 ? (
          <SurfaceCard className="surface-card--soft">
            <div className="section-title">Recent wins</div>
            <div className="pill-row pill-row--top-md">
              {viewModel.recentWins.map((title) => (
                <span className="tag-badge" key={title}>{title}</span>
              ))}
            </div>
          </SurfaceCard>
        ) : null}

        <SurfaceCard className="surface-card--soft">
          <div className="row-card row-card--bare">
            <div className="row-card__icon">AI</div>
            <div className="row-card__content">
              <div className="row-card__title">{viewModel.quickStart.title}</div>
              <div className="row-card__copy">{viewModel.quickStart.description}</div>
            </div>
            <Link className="primary-button" href={viewModel.quickStart.ctaHref}>
              {viewModel.quickStart.ctaLabel}
            </Link>
          </div>
        </SurfaceCard>
      </div>
    </DashboardLayout>
  );
}
