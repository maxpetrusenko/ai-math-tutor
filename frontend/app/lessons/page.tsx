"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { DashboardLayout } from "../../components/layout";
import { OptionPillRow } from "../../components/ui/OptionPillRow";
import { PageHeader } from "../../components/ui/PageHeader";
import { filterLessonCatalog } from "../../lib/lesson_catalog";
import { writeSessionPreferences } from "../../lib/session_preferences";

const GRADE_OPTIONS = ["All", "K-2", "3-5", "6-8", "9-12"];

function mapLessonGradeToPreference(grade: string) {
  if (grade === "9-12") {
    return "11-12";
  }

  if (grade === "K-2" || grade === "3-5") {
    return "6-8";
  }

  return grade;
}

export default function LessonsPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [activeGrade, setActiveGrade] = useState("All");
  const lessons = filterLessonCatalog({ activeGrade, query });

  return (
    <DashboardLayout>
      <div className="page-shell">
        <PageHeader
          subtitle="Browse, filter, and jump straight into a tutor-guided lesson."
          title="Lessons"
        />

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
              <div className="row-card__icon" style={{ marginBottom: "18px" }}>{lesson.symbol}</div>
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
