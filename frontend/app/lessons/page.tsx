"use client";

import React, { useState } from "react";
import { DashboardLayout } from "../../components/layout";
import Link from "next/link";

type Filter = "all" | "math" | "science" | "english";
type Difficulty = "easy" | "medium" | "hard";

const allLessons = [
  {
    id: 1,
    title: "Introduction to Fractions",
    subject: "math",
    grade: "3-5",
    difficulty: "easy" as Difficulty,
    time: "15 min",
    description: "Learn the basics of fractions with visual examples.",
  },
  {
    id: 2,
    title: "Basic Algebra",
    subject: "math",
    grade: "6-8",
    difficulty: "medium" as Difficulty,
    time: "20 min",
    description: "Solve for x and understand algebraic expressions.",
  },
  {
    id: 3,
    title: "Geometry Fundamentals",
    subject: "math",
    grade: "3-5",
    difficulty: "easy" as Difficulty,
    time: "18 min",
    description: "Shapes, angles, and perimeter explained simply.",
  },
  {
    id: 4,
    title: "Advanced Calculus",
    subject: "math",
    grade: "9-12",
    difficulty: "hard" as Difficulty,
    time: "30 min",
    description: "Derivatives and integrals made understandable.",
  },
  {
    id: 5,
    title: "Multiplication Master",
    subject: "math",
    grade: "3-5",
    difficulty: "easy" as Difficulty,
    time: "12 min",
    description: "Master your times tables with fun practice.",
  },
  {
    id: 6,
    title: "Division Challenge",
    subject: "math",
    grade: "3-5",
    difficulty: "medium" as Difficulty,
    time: "15 min",
    description: "Long division made easy with step-by-step guidance.",
  },
  {
    id: 7,
    title: "Plant Biology Basics",
    subject: "science",
    grade: "6-8",
    difficulty: "easy" as Difficulty,
    time: "20 min",
    description: "Learn how plants grow and make their food.",
  },
  {
    id: 8,
    title: "Chemistry: Atoms",
    subject: "science",
    grade: "9-12",
    difficulty: "medium" as Difficulty,
    time: "25 min",
    description: "Understanding the building blocks of matter.",
  },
];

export default function LessonsPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty | "all">("all");

  const filteredLessons = allLessons.filter((lesson) => {
    if (activeFilter !== "all" && lesson.subject !== activeFilter) return false;
    if (activeDifficulty !== "all" && lesson.difficulty !== activeDifficulty) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <div style={{ padding: 0 }}>
        {/* Page Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "8px" }}>
            Lessons
          </h1>
          <p style={{ color: "var(--ink-dim)" }}>
            Browse lessons by subject and difficulty level
          </p>
        </div>

        {/* Filters */}
        <div className="lessons-page__filters">
          <button
            className={`filter-chip ${activeFilter === "all" ? "filter-chip--active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            All Subjects
          </button>
          <button
            className={`filter-chip ${activeFilter === "math" ? "filter-chip--active" : ""}`}
            onClick={() => setActiveFilter("math")}
          >
            Math
          </button>
          <button
            className={`filter-chip ${activeFilter === "science" ? "filter-chip--active" : ""}`}
            onClick={() => setActiveFilter("science")}
          >
            Science
          </button>
          <button
            className={`filter-chip ${activeFilter === "english" ? "filter-chip--active" : ""}`}
            onClick={() => setActiveFilter("english")}
          >
            English
          </button>
        </div>

        <div className="lessons-page__filters">
          <span style={{ color: "var(--ink-dim)", fontSize: "0.9rem", marginRight: "12px" }}>
            Difficulty:
          </span>
          <button
            className={`filter-chip ${activeDifficulty === "all" ? "filter-chip--active" : ""}`}
            onClick={() => setActiveDifficulty("all")}
          >
            All
          </button>
          <button
            className={`filter-chip ${activeDifficulty === "easy" ? "filter-chip--active" : ""}`}
            onClick={() => setActiveDifficulty("easy")}
          >
            Easy
          </button>
          <button
            className={`filter-chip ${activeDifficulty === "medium" ? "filter-chip--active" : ""}`}
            onClick={() => setActiveDifficulty("medium")}
          >
            Medium
          </button>
          <button
            className={`filter-chip ${activeDifficulty === "hard" ? "filter-chip--active" : ""}`}
            onClick={() => setActiveDifficulty("hard")}
          >
            Hard
          </button>
        </div>

        {/* Results */}
        <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", margin: "16px 0" }}>
          Showing {filteredLessons.length} lesson{filteredLessons.length !== 1 ? "s" : ""}
        </p>

        {/* Lessons Grid */}
        <div className="lessons-grid">
          {filteredLessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/session?lesson=${lesson.id}`}
              className="lesson-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="lesson-card__header">
                <span className="lesson-card__subject">
                  {lesson.subject.charAt(0).toUpperCase() + lesson.subject.slice(1)}
                </span>
                <span
                  className={`lesson-card__difficulty lesson-card__difficulty--${lesson.difficulty}`}
                >
                  {lesson.difficulty}
                </span>
              </div>
              <h3 className="lesson-card__title">{lesson.title}</h3>
              <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "12px" }}>
                {lesson.description}
              </p>
              <div className="lesson-card__meta">
                <span>Grade {lesson.grade}</span>
                <span>• {lesson.time}</span>
              </div>
            </Link>
          ))}
        </div>

        {filteredLessons.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "var(--ink-dim)",
            }}
          >
            <div
              style={{
                fontSize: "48px",
                marginBottom: "16px",
              }}
            >
              📚
            </div>
            <p>No lessons match your filters. Try selecting different options.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
