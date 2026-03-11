"use client";

import React from "react";
import { DashboardLayout } from "../../components/layout";
import Link from "next/link";

export default function DashboardPage() {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Mock data - replace with real data from your backend
  const stats = [
    { label: "Lessons Completed", value: "12" },
    { label: "Current Streak", value: "5 days" },
    { label: "Time Learning", value: "4.2h" },
  ];

  const recentLessons = [
    { id: 1, title: "Introduction to Fractions", subject: "Math", grade: "3-5", progress: 75 },
    { id: 2, title: "Basic Algebra", subject: "Math", grade: "6-8", progress: 45 },
    { id: 3, title: "Geometry Basics", subject: "Math", grade: "3-5", progress: 100 },
  ];

  const recommendedLessons = [
    { id: 4, title: "Multiplication Master", subject: "Math", grade: "3-5", difficulty: "easy" },
    { id: 5, title: "Division Challenge", subject: "Math", grade: "3-5", difficulty: "medium" },
    { id: 6, title: "Word Problems", subject: "Math", grade: "6-8", difficulty: "hard" },
  ];

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        {/* Hero Section */}
        <section className="dashboard-hero">
          <p className="dashboard-hero__greeting">{getGreeting()}!</p>
          <h1 className="dashboard-hero__title">Ready to learn?</h1>
          <p className="dashboard-hero__subtitle">
            Continue where you left off or try something new today.
          </p>
          <Link
            href="/session"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "16px",
              padding: "12px 24px",
              background: "linear-gradient(135deg, var(--accent), var(--secondary))",
              color: "white",
              borderRadius: "10px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polygon points="5 3 19 12 5 21 5 3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Start Learning
          </Link>
        </section>

        {/* Stats */}
        <div className="dashboard-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="stat-card__label">{stat.label}</div>
              <div className="stat-card__value">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Recent Lessons */}
        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2 className="dashboard-section__title">Continue Learning</h2>
            <Link href="/lessons" className="dashboard-section__link">
              View all →
            </Link>
          </div>
          <div className="lessons-grid">
            {recentLessons.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/session?lesson=${lesson.id}`}
                className="lesson-card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="lesson-card__header">
                  <span className="lesson-card__subject">{lesson.subject}</span>
                  <span className="lesson-card__difficulty lesson-card__difficulty--easy">
                    {lesson.grade}
                  </span>
                </div>
                <h3 className="lesson-card__title">{lesson.title}</h3>
                <div style={{ marginTop: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      color: "var(--ink-dim)",
                      marginBottom: "6px",
                    }}
                  >
                    <span>Progress</span>
                    <span>{lesson.progress}%</span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      background: "var(--bg-subtle)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${lesson.progress}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, var(--accent), var(--secondary))",
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recommended Lessons */}
        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2 className="dashboard-section__title">Recommended for You</h2>
            <Link href="/lessons" className="dashboard-section__link">
              View all →
            </Link>
          </div>
          <div className="lessons-grid">
            {recommendedLessons.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/session?lesson=${lesson.id}`}
                className="lesson-card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="lesson-card__header">
                  <span className="lesson-card__subject">{lesson.subject}</span>
                  <span
                    className={`lesson-card__difficulty lesson-card__difficulty--${lesson.difficulty}`}
                  >
                    {lesson.difficulty}
                  </span>
                </div>
                <h3 className="lesson-card__title">{lesson.title}</h3>
                <div className="lesson-card__meta">
                  <span>{lesson.grade}</span>
                  <span>• ~15 min</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
