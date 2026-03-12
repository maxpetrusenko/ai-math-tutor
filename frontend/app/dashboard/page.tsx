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

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      await hydrateLessonThreadStore();
      if (!cancelled) {
        setLearningSnapshot(readDashboardLearningSnapshot());
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  const viewModel = buildDashboardViewModel({
    activeThread: learningSnapshot.activeThread,
    archivedLessons: learningSnapshot.archivedLessons,
    displayName: user?.displayName,
    email: user?.email,
    preferences: readSessionPreferences(),
  });

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

        <SurfaceCard className="surface-card--soft">
          <div className="row-card" style={{ background: "transparent", border: "none", padding: 0 }}>
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
