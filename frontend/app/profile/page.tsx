"use client";

import React, { useEffect, useState } from "react";

import { DashboardLayout } from "../../components/layout";
import { MetricCard } from "../../components/ui/MetricCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { useFirebaseAuth } from "../../lib/firebase_auth";
import {
  hydrateLessonThreadStore,
  listArchivedLessonThreads,
  readPersistedLessonThread,
  type PersistedLessonSummary,
} from "../../lib/lesson_thread_store";
import { buildProfileViewModel } from "../../lib/profile_view_model";
import { readSessionPreferences } from "../../lib/session_preferences";

export default function ProfilePage() {
  const { user } = useFirebaseAuth();
  const [learningSnapshot, setLearningSnapshot] = useState(() => ({
    activeThread: readPersistedLessonThread(),
    archivedLessons: listArchivedLessonThreads(),
    archivedLessonCount: listArchivedLessonThreads().length,
  }));

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      await hydrateLessonThreadStore();
      if (!cancelled) {
        setLearningSnapshot({
          activeThread: readPersistedLessonThread(),
          archivedLessons: listArchivedLessonThreads(),
          archivedLessonCount: listArchivedLessonThreads().length,
        });
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  const model = buildProfileViewModel({
    activeThread: learningSnapshot.activeThread,
    archivedLessonCount: learningSnapshot.archivedLessonCount,
    displayName: user?.displayName,
    email: user?.email,
    preferences: readSessionPreferences(),
  });

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
            <p className="section-copy" style={{ marginTop: "10px" }}>{model.supportNote}</p>
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

        <SurfaceCard className="surface-card--soft">
          <div className="row-card profile-page__status-card" style={{ background: "transparent", border: "none", padding: 0 }}>
            <div className="row-card__icon">AI</div>
            <div className="row-card__content">
              <div className="row-card__title">{model.statusTitle}</div>
              <div className="row-card__copy">{model.statusCopy}</div>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="section-title" style={{ marginBottom: "16px" }}>Account summary</div>
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
              {learningSnapshot.archivedLessons.slice(0, 3).map((lesson: PersistedLessonSummary) => (
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
      </div>
    </DashboardLayout>
  );
}
