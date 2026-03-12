"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { DashboardLayout } from "../../components/layout";
import { OptionPillRow } from "../../components/ui/OptionPillRow";
import { PageHeader } from "../../components/ui/PageHeader";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { filterLessonCatalog } from "../../lib/lesson_catalog";
import {
  hydrateLessonThreadStore,
  readPersistedLessonThread,
} from "../../lib/lesson_thread_store";
import { readSessionPreferences, writeSessionPreferences } from "../../lib/session_preferences";

const GRADE_OPTIONS = ["All", "K-2", "3-5", "6-8", "9-12"];

function mapLessonGradeToPreference(grade: string) {
  return grade;
}

export default function LessonsPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [activeGrade, setActiveGrade] = useState("All");
  const [activeThread, setActiveThread] = useState(() => readPersistedLessonThread());
  const preferences = readSessionPreferences();
  const lessons = filterLessonCatalog({ activeGrade, query });
  const studyStyle = preferences.preference.trim() || "Balanced guidance";

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      await hydrateLessonThreadStore();
      if (!cancelled) {
        setActiveThread(readPersistedLessonThread());
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="page-shell">
        <PageHeader
          subtitle="Browse, filter, and jump straight into a tutor-guided lesson."
          title="Lessons"
        />

        <div className="field-grid dashboard-focus-grid">
          <SurfaceCard className="surface-card--soft dashboard-focus-card">
            <div className="section-title">Resume checkpoint</div>
            <div className="section-copy section-copy--top-sm">
              {activeThread?.lessonState
                ? "Nerdy remembers the current task and next question from your active lesson."
                : "Pick any lesson and Nerdy will save where you stopped."}
            </div>
            <div className="info-list info-list--top-sm">
              <div className="info-list__row">
                <div className="info-list__label">Active lesson</div>
                <div className="info-list__value">{activeThread?.lessonState?.lessonTitle ?? "No active lesson"}</div>
              </div>
              <div className="info-list__row">
                <div className="info-list__label">Next question</div>
                <div className="info-list__value">{activeThread?.lessonState?.nextQuestion ?? "Start a lesson to get a guided question here."}</div>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="surface-card--soft dashboard-focus-card">
            <div className="section-title">Browse setup</div>
            <div className="section-copy section-copy--top-sm">
              Lessons open with your saved defaults for grade, subject, and tutoring style.
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
        </div>

        <SurfaceHeader />

        <OptionPillRow
          activeValue={activeGrade}
          ariaLabel="Lesson grade filters"
          onSelect={setActiveGrade}
          options={GRADE_OPTIONS.map((grade) => ({ label: grade, value: grade }))}
        />

        <div className="lessons-grid">
          {lessons.map((lesson) => (
            <Link
              className="lesson-card"
              href={`/session?lesson=${lesson.id}`}
              key={lesson.id}
              onClick={() => {
                writeSessionPreferences({
                  gradeBand: mapLessonGradeToPreference(lesson.grade),
                  subject: lesson.subject.toLowerCase() === "fractions" || lesson.subject.toLowerCase() === "geometry"
                    ? "math"
                    : "math",
                });
              }}
            >
              <div className="lesson-card__header">
                <span className="lesson-card__subject">{lesson.grade}</span>
                <span className={`lesson-card__difficulty lesson-card__difficulty--${lesson.level === "Beginner" ? "easy" : lesson.level === "Intermediate" ? "medium" : "hard"}`}>
                  {lesson.level}
                </span>
              </div>
              <div className="row-card__icon lesson-card__icon">{lesson.symbol}</div>
              <h3 className="lesson-card__title">{lesson.title}</h3>
              <p className="row-card__copy">{lesson.description}</p>
              <div className="lesson-card__meta">
                <span>{lesson.subject}</span>
                <span>{lesson.duration}</span>
              </div>
            </Link>
          ))}
        </div>

        {lessons.length === 0 ? (
          <div className="surface-card">
            <div className="section-title">No lessons found</div>
            <p className="section-copy">Try a different query or switch grade bands.</p>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );

  function SurfaceHeader() {
    return (
      <div className="surface-card">
        <div className="field">
          <span>Search lessons</span>
          <input
            aria-label="Search lessons"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Addition, fractions, algebra..."
            type="search"
            value={query}
          />
        </div>
      </div>
    );
  }
}
